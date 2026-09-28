import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { empresas, leads, limitesTaxa, type Empresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { ErroLimiteExcedido, ErroNaoEncontrado, ErroValidacao } from "@/lib/erros";
import { VERSAO_DO_CONSENTIMENTO } from "@/lib/validacao/lead";
import { criarCarimbo } from "@/server/seguranca/carimbo";
import { limitadorNoBanco } from "@/server/seguranca/limitador";
import {
  LIMITES_DA_CAPTACAO,
  captarLead,
  obterFormularioPublico,
  type DependenciasDaCaptacao,
} from "@/server/services/captacao";

import { criarBancoDeTeste, criarEmpresaDeTeste } from "./banco";

/** Limitador de taxa e captação pública com o banco real (PGlite). */

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
  // O serviço registra no log cada envio; aqui o log não interessa.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(async () => {
  vi.restoreAllMocks();
  await encerrar();
});

const AGORA = new Date("2026-09-26T15:00:00.000Z");
const segundosAntes = (segundos: number) => new Date(AGORA.getTime() - segundos * 1000);

let ipsUsados = 0;
/** IP fictício novo a cada chamada (faixa de documentação 198.51.100.0/24). */
function ipNovo() {
  ipsUsados += 1;
  return `198.51.100.${ipsUsados}`;
}

function corpoValido(empresa: Empresa, extras: Record<string, unknown> = {}) {
  return {
    nome: "Maria Souza",
    email: "Maria@Metalurgica.example",
    telefone: "(24) 99999-0001",
    empresaNome: "Metalúrgica Souza",
    segmento: "Indústria",
    mensagem: "Precisamos de um site novo com catálogo e orçamento online.",
    consentimento: "sim",
    carimbo: criarCarimbo(empresa.id, segundosAntes(30)),
    website: "",
    ...extras,
  };
}

function dependencias() {
  return {
    limitador: limitadorNoBanco(db),
    agendarAnalise: vi.fn<DependenciasDaCaptacao["agendarAnalise"]>(),
  };
}

async function leadsDa(empresa: Empresa) {
  return db.select().from(leads).where(eq(leads.empresaId, empresa.id));
}

describe("limitador de taxa no banco", () => {
  const regra = (chave: string) => ({ chave, limite: 3, janelaMs: 60_000 });

  it("permite até o limite na janela e depois informa quando tentar de novo", async () => {
    const limitador = limitadorNoBanco(db);
    const chave = `teste:${ipNovo()}`;

    const resultados = [];
    for (let i = 0; i < 4; i += 1) {
      resultados.push(await limitador.consumir(regra(chave), new Date(AGORA.getTime() + i * 1000)));
    }

    expect(resultados.slice(0, 3).every((r) => r.permitido)).toBe(true);
    // A janela começou em AGORA; a quarta tentativa foi 3 s depois: faltam 57 s.
    expect(resultados[3]).toEqual({ permitido: false, tentarNovamenteEmSegundos: 57 });
  });

  it("uma janela nova recomeça a contagem, reaproveitando a mesma linha", async () => {
    const limitador = limitadorNoBanco(db);
    const chave = `teste:${ipNovo()}`;
    for (let i = 0; i < 4; i += 1) {
      await limitador.consumir(regra(chave), AGORA);
    }

    const depois = await limitador.consumir(regra(chave), new Date(AGORA.getTime() + 60_000));

    expect(depois).toEqual({ permitido: true });
    const linhas = await db.select().from(limitesTaxa).where(eq(limitesTaxa.chave, chave));
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.contador).toBe(1);
  });

  it("pedidos simultâneos são todos contados (atômico)", async () => {
    const limitador = limitadorNoBanco(db);
    const chave = `teste:${ipNovo()}`;

    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => limitador.consumir(regra(chave), AGORA)),
    );

    expect(resultados.filter((r) => r.permitido)).toHaveLength(3);
    const [linha] = await db.select().from(limitesTaxa).where(eq(limitesTaxa.chave, chave));
    expect(linha?.contador).toBe(8);
  });
});

describe("captação: envio aceito", () => {
  it("grava o lead com consentimento, hash do IP e agenda a análise", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const deps = dependencias();
    const ip = ipNovo();

    const resultado = await captarLead(
      db,
      { slug: empresa.slug, corpo: corpoValido(empresa), ip, agora: AGORA },
      deps,
    );

    expect(resultado.situacao).toBe("recebido");
    const [lead] = await leadsDa(empresa);
    expect(lead).toMatchObject({
      nome: "Maria Souza",
      email: "maria@metalurgica.example",
      segmento: "Indústria",
      origem: "formulario",
      statusAnalise: "pendente",
      consentimentoLgpd: true,
      consentimentoEm: AGORA,
      consentimentoVersaoTexto: VERSAO_DO_CONSENTIMENTO,
    });
    // O IP nunca é gravado puro: só o HMAC.
    expect(lead?.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(lead?.ipHash).not.toContain(ip);
    expect(deps.agendarAnalise).toHaveBeenCalledWith(empresa.id, lead?.id);
  });

  it("campos opcionais vazios ou ausentes viram nulos", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const corpo: Record<string, unknown> = corpoValido(empresa, { telefone: "", segmento: "" });
    delete corpo.empresaNome;

    await captarLead(db, { slug: empresa.slug, corpo, ip: ipNovo(), agora: AGORA }, dependencias());

    const [lead] = await leadsDa(empresa);
    expect(lead).toMatchObject({ telefone: null, segmento: null, empresaNome: null });
  });

  it("sem IP informado, grava o lead sem hash", async () => {
    const empresa = await criarEmpresaDeTeste(db);

    await captarLead(
      db,
      { slug: empresa.slug, corpo: corpoValido(empresa), ip: null, agora: AGORA },
      dependencias(),
    );

    const [lead] = await leadsDa(empresa);
    expect(lead?.ipHash).toBeNull();
  });
});

describe("captação: anti-spam", () => {
  it("campo-armadilha preenchido: finge receber, mas não grava nem analisa", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const deps = dependencias();

    const resultado = await captarLead(
      db,
      {
        slug: empresa.slug,
        corpo: corpoValido(empresa, { website: "http://spam.example" }),
        ip: ipNovo(),
        agora: AGORA,
      },
      deps,
    );

    expect(resultado).toEqual({ situacao: "descartado", motivo: "armadilha" });
    expect(await leadsDa(empresa)).toHaveLength(0);
    expect(deps.agendarAnalise).not.toHaveBeenCalled();
  });

  it("enviado em menos de 3 segundos: descartado em silêncio", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const corpo = corpoValido(empresa, { carimbo: criarCarimbo(empresa.id, segundosAntes(1)) });

    const resultado = await captarLead(
      db,
      { slug: empresa.slug, corpo, ip: ipNovo(), agora: AGORA },
      dependencias(),
    );

    expect(resultado).toEqual({ situacao: "descartado", motivo: "rapido_demais" });
    expect(await leadsDa(empresa)).toHaveLength(0);
  });

  it.each<[string, (empresa: Empresa) => string | undefined]>([
    ["sem carimbo", () => undefined],
    ["carimbo adulterado", (empresa) => `${criarCarimbo(empresa.id, AGORA)}0`],
    ["carimbo de outra empresa", () => criarCarimbo("outra-empresa", AGORA)],
    [
      "carimbo com mais de 24 horas",
      (empresa) => criarCarimbo(empresa.id, segundosAntes(25 * 3600)),
    ],
  ])("%s: pede para recarregar a página", async (_caso, carimbo) => {
    const empresa = await criarEmpresaDeTeste(db);

    const envio = captarLead(
      db,
      {
        slug: empresa.slug,
        corpo: corpoValido(empresa, { carimbo: carimbo(empresa) }),
        ip: ipNovo(),
        agora: AGORA,
      },
      dependencias(),
    );

    await expect(envio).rejects.toThrow(/Recarregue a página/);
    expect(await leadsDa(empresa)).toHaveLength(0);
  });
});

describe("captação: validação e empresa", () => {
  it("sem consentimento (LGPD): recusa com o erro no campo", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const corpo: Record<string, unknown> = corpoValido(empresa);
    delete corpo.consentimento;

    const erro = await captarLead(
      db,
      { slug: empresa.slug, corpo, ip: ipNovo(), agora: AGORA },
      dependencias(),
    ).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroValidacao);
    expect((erro as ErroValidacao).detalhes).toEqual([
      expect.objectContaining({ campo: "consentimento" }),
    ]);
  });

  it("corpo que não é objeto: recusa", async () => {
    const empresa = await criarEmpresaDeTeste(db);

    await expect(
      captarLead(db, { slug: empresa.slug, corpo: ["x"], ip: ipNovo() }, dependencias()),
    ).rejects.toBeInstanceOf(ErroValidacao);
  });

  it("formulário inexistente ou com endereço inválido: não encontrado", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const corpo = corpoValido(empresa);

    for (const slug of ["nao-existe-123", "../admin", "A".repeat(80)]) {
      await expect(
        captarLead(db, { slug, corpo, ip: ipNovo(), agora: AGORA }, dependencias()),
      ).rejects.toBeInstanceOf(ErroNaoEncontrado);
    }
  });

  it("empresa bloqueada não recebe leads", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    await db.update(empresas).set({ status: "bloqueada" }).where(eq(empresas.id, empresa.id));

    await expect(
      captarLead(
        db,
        { slug: empresa.slug, corpo: corpoValido(empresa), ip: ipNovo(), agora: AGORA },
        dependencias(),
      ),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
  });
});

describe("captação: limites de envio", () => {
  it("o sexto envio do mesmo IP em 10 minutos é recusado; outro IP continua", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const ip = ipNovo();
    const enviar = (ipDoEnvio: string) =>
      captarLead(
        db,
        { slug: empresa.slug, corpo: corpoValido(empresa), ip: ipDoEnvio, agora: AGORA },
        dependencias(),
      );

    for (let i = 0; i < LIMITES_DA_CAPTACAO.porIpNoFormulario.limite; i += 1) {
      await enviar(ip);
    }
    const erro = await enviar(ip).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroLimiteExcedido);
    expect((erro as ErroLimiteExcedido).tentarNovamenteEmSegundos).toBe(600);
    await expect(enviar(ipNovo())).resolves.toMatchObject({ situacao: "recebido" });
    expect(await leadsDa(empresa)).toHaveLength(6);
  });

  it("tentativas barradas por IP não gastam o limite do formulário", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const ip = ipNovo();
    for (let i = 0; i < 9; i += 1) {
      await captarLead(
        db,
        { slug: empresa.slug, corpo: corpoValido(empresa), ip, agora: AGORA },
        dependencias(),
      ).catch(() => undefined);
    }

    const [doFormulario] = await db
      .select()
      .from(limitesTaxa)
      .where(eq(limitesTaxa.chave, `captacao:${empresa.id}`));
    expect(doFormulario?.contador).toBe(LIMITES_DA_CAPTACAO.porIpNoFormulario.limite);
  });

  it("formulário no limite: recusa com mensagem própria", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const limitador = {
      consumir: vi.fn(async ({ chave }: { chave: string }) =>
        chave === `captacao:${empresa.id}`
          ? { permitido: false as const, tentarNovamenteEmSegundos: 120 }
          : { permitido: true as const },
      ),
    };

    const envio = captarLead(
      db,
      { slug: empresa.slug, corpo: corpoValido(empresa), ip: ipNovo(), agora: AGORA },
      { limitador, agendarAnalise: vi.fn() },
    );

    await expect(envio).rejects.toThrow(/Este formulário recebeu muitas mensagens/);
    expect(await leadsDa(empresa)).toHaveLength(0);
  });
});

describe("obterFormularioPublico", () => {
  it("devolve só o nome da empresa e um carimbo válido", async () => {
    const empresa = await criarEmpresaDeTeste(db);

    const formulario = await obterFormularioPublico(db, empresa.slug, segundosAntes(10));

    expect(formulario).toEqual({ nomeDaEmpresa: empresa.nome, carimbo: expect.any(String) });
    // O carimbo gerado para a página é aceito no envio.
    await expect(
      captarLead(
        db,
        {
          slug: empresa.slug,
          corpo: corpoValido(empresa, { carimbo: formulario.carimbo }),
          ip: ipNovo(),
          agora: AGORA,
        },
        dependencias(),
      ),
    ).resolves.toMatchObject({ situacao: "recebido" });
  });

  it("empresa bloqueada: não encontrado", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    await db.update(empresas).set({ status: "bloqueada" }).where(eq(empresas.id, empresa.id));

    await expect(obterFormularioPublico(db, empresa.slug)).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    );
  });
});
