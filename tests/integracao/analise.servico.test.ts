import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { analises, auditoria, leads, usoMensal, usuarios, type Empresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { ErroConflito, ErroNaoEncontrado, ErroProibido } from "@/lib/erros";
import { motorSimulado } from "@/server/ia/mock";
import { ErroDaIA, type MotorDeAnalise } from "@/server/ia/motor";
import { montarMensagem, type EntradaDaAnalise } from "@/server/ia/prompt";
import { criarLead, type DadosDeNovoLead } from "@/server/repositories/leads";
import { analisarLead, reanalisarLead } from "@/server/services/analise";

import { criarBancoDeTeste, criarEmpresaDeTeste } from "./banco";

/** Serviço de análise com o banco real (PGlite) e motores controlados pelo teste. */

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
  // O serviço registra no log cada análise; aqui o log não interessa.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(async () => {
  vi.restoreAllMocks();
  await encerrar();
});

const LEAD: DadosDeNovoLead = {
  nome: "Maria Souza",
  email: "maria@metalurgica.example",
  telefone: "(24) 99999-0001",
  empresaNome: "Metalúrgica Souza",
  segmento: "Indústria",
  mensagem: "Precisamos de um orçamento para um site novo com catálogo.",
  consentimentoLgpd: true,
  consentimentoEm: new Date(),
};

async function cenario(limite = 100) {
  const empresa = await criarEmpresaDeTeste(db, limite);
  const lead = await criarLead(db, empresa.id, LEAD);
  return { empresa, leadId: lead.id };
}

/** Motor que devolve uma resposta fixa e guarda o que recebeu. */
function motorFixo(score = 85, tokens = { entrada: 1200, saida: 300 }) {
  const recebidas: EntradaDaAnalise[] = [];
  const motor: MotorDeAnalise = {
    analisar: vi.fn(async (entrada: EntradaDaAnalise) => {
      recebidas.push(entrada);
      return {
        resposta: { score, justificativa: "Pediu orçamento.", respostaSugerida: "Olá!" },
        modelo: "claude-haiku-4-5-20251001",
        tokens,
        tentativas: 1,
        mock: false,
      };
    }),
  };
  return { motor, recebidas };
}

function motorQueFalha(erro: Error): MotorDeAnalise {
  return { analisar: vi.fn(async () => Promise.reject(erro)) };
}

async function estadoDoLead(leadId: string) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
  return lead;
}

async function usoDaEmpresa(empresa: Empresa) {
  const [uso] = await db.select().from(usoMensal).where(eq(usoMensal.empresaId, empresa.id));
  return uso;
}

async function analisesDoLead(leadId: string) {
  return db.select().from(analises).where(eq(analises.leadId, leadId));
}

describe("análise concluída", () => {
  it("grava a análise, atualiza o lead e registra consumo e tokens", async () => {
    const { empresa, leadId } = await cenario();
    const { motor } = motorFixo(85);

    const resultado = await analisarLead(db, motor, empresa.id, leadId);

    expect(resultado).toEqual({ situacao: "concluida", score: 85, classificacao: "quente" });
    expect(await estadoDoLead(leadId)).toMatchObject({
      statusAnalise: "concluida",
      scoreAtual: 85,
      classificacaoAtual: "quente",
    });
    const [analise] = await analisesDoLead(leadId);
    expect(analise).toMatchObject({
      score: 85,
      classificacao: "quente",
      modelo: "claude-haiku-4-5-20251001",
      promptVersion: "v1",
      perfilVersao: empresa.perfilVersao,
      tokensEntrada: 1200,
      tokensSaida: 300,
      mock: false,
      solicitadaPor: null,
    });
    expect(await usoDaEmpresa(empresa)).toMatchObject({
      analises: 1,
      tokensEntrada: 1200,
      tokensSaida: 300,
    });
  });

  it("a classificação vem da nota, pela regra fixa do app", async () => {
    const { empresa, leadId } = await cenario();

    await analisarLead(db, motorFixo(55).motor, empresa.id, leadId);

    expect((await estadoDoLead(leadId))?.classificacaoAtual).toBe("morno");
  });

  it("com o motor simulado, a análise fica marcada como mock", async () => {
    const { empresa, leadId } = await cenario();

    await analisarLead(db, motorSimulado, empresa.id, leadId);

    expect((await analisesDoLead(leadId))[0]).toMatchObject({ mock: true, modelo: "mock" });
  });

  it("minimização (LGPD): nome, e-mail e telefone do lead não vão para a IA", async () => {
    const { empresa, leadId } = await cenario();
    const { motor, recebidas } = motorFixo();

    await analisarLead(db, motor, empresa.id, leadId);

    const enviado = JSON.stringify(recebidas) + montarMensagem(recebidas[0] as EntradaDaAnalise);
    expect(enviado).not.toContain(LEAD.nome);
    expect(enviado).not.toContain("maria@");
    expect(enviado).not.toContain("99999");
    expect(enviado).toContain("Metalúrgica Souza");
  });
});

describe("limite mensal (D-008)", () => {
  it("sem saldo, o lead fica limite_atingido e a IA não é chamada", async () => {
    const { empresa, leadId } = await cenario(0);
    const { motor } = motorFixo();

    expect(await analisarLead(db, motor, empresa.id, leadId)).toEqual({
      situacao: "limite_atingido",
    });
    expect(motor.analisar).not.toHaveBeenCalled();
    expect((await estadoDoLead(leadId))?.statusAnalise).toBe("limite_atingido");
  });

  it("consome até o limite e para", async () => {
    const empresa = await criarEmpresaDeTeste(db, 2);
    const situacoes = [];
    for (let i = 0; i < 3; i += 1) {
      const lead = await criarLead(db, empresa.id, LEAD);
      situacoes.push((await analisarLead(db, motorFixo().motor, empresa.id, lead.id)).situacao);
    }

    expect(situacoes).toEqual(["concluida", "concluida", "limite_atingido"]);
    expect((await usoDaEmpresa(empresa))?.analises).toBe(2);
  });
});

describe("falhas da IA", () => {
  it("devolve a análise consumida, registra os tokens gastos e marca falhou", async () => {
    const { empresa, leadId } = await cenario();
    const erro = new ErroDaIA("formato_invalido", "JSON inválido", {
      tokens: { entrada: 2400, saida: 600 },
    });

    const resultado = await analisarLead(db, motorQueFalha(erro), empresa.id, leadId);

    expect(resultado).toEqual({ situacao: "falhou", motivo: "formato_invalido" });
    expect((await estadoDoLead(leadId))?.statusAnalise).toBe("falhou");
    expect(await analisesDoLead(leadId)).toEqual([]);
    // O cliente não perde a análise; o custo real continua registrado.
    expect(await usoDaEmpresa(empresa)).toMatchObject({
      analises: 0,
      tokensEntrada: 2400,
      tokensSaida: 600,
    });
  });

  it("erro inesperado também devolve a análise e marca falhou", async () => {
    const { empresa, leadId } = await cenario();

    const resultado = await analisarLead(db, motorQueFalha(new Error("bug")), empresa.id, leadId);

    expect(resultado).toEqual({ situacao: "falhou", motivo: "erro_interno" });
    expect((await usoDaEmpresa(empresa))?.analises).toBe(0);
  });

  it("depois de falhar, o lead pode ser analisado de novo", async () => {
    const { empresa, leadId } = await cenario();
    await analisarLead(db, motorQueFalha(new Error("fora do ar")), empresa.id, leadId);

    const resultado = await analisarLead(db, motorFixo().motor, empresa.id, leadId);

    expect(resultado.situacao).toBe("concluida");
  });
});

describe("concorrência e estados", () => {
  it("dois pedidos ao mesmo tempo: só um analisa", async () => {
    const { empresa, leadId } = await cenario();
    let liberar = () => {};
    const lento: MotorDeAnalise = {
      analisar: vi.fn(async (entrada: EntradaDaAnalise) => {
        await new Promise<void>((resolver) => {
          liberar = resolver;
        });
        return motorFixo().motor.analisar(entrada);
      }),
    };

    const primeiro = analisarLead(db, lento, empresa.id, leadId);
    await vi.waitFor(() => expect(lento.analisar).toHaveBeenCalledOnce());
    const segundo = await analisarLead(db, lento, empresa.id, leadId);
    liberar();

    expect(segundo).toEqual({ situacao: "em_andamento" });
    expect((await primeiro).situacao).toBe("concluida");
    expect(await analisesDoLead(leadId)).toHaveLength(1);
    expect((await usoDaEmpresa(empresa))?.analises).toBe(1);
  });

  it("análise interrompida há mais de 5 minutos pode ser retomada", async () => {
    const { empresa, leadId } = await cenario();
    await db
      .update(leads)
      .set({ statusAnalise: "processando", updatedAt: sql`now() - interval '6 minutes'` })
      .where(eq(leads.id, leadId));

    expect((await analisarLead(db, motorFixo().motor, empresa.id, leadId)).situacao).toBe(
      "concluida",
    );
  });

  it("lead de outra empresa: não encontrado (isolamento)", async () => {
    const { leadId } = await cenario();
    const outra = await criarEmpresaDeTeste(db);

    await expect(analisarLead(db, motorFixo().motor, outra.id, leadId)).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    );
  });

  it("lead anonimizado não é analisado", async () => {
    const { empresa, leadId } = await cenario();
    await db.update(leads).set({ anonimizadoEm: new Date() }).where(eq(leads.id, leadId));

    await expect(analisarLead(db, motorFixo().motor, empresa.id, leadId)).rejects.toBeInstanceOf(
      ErroConflito,
    );
  });
});

describe("reanálise pelo painel (RBAC)", () => {
  async function usuario(papel: "cliente" | "suporte" | "admin", empresaIds: string[]) {
    const [linha] = await db
      .insert(usuarios)
      .values({
        nome: "Pessoa",
        email: `reanalise-${crypto.randomUUID()}@teste.example`,
        papelPlataforma: papel === "cliente" ? null : papel,
      })
      .returning();
    if (!linha) {
      throw new Error("usuário não criado");
    }
    return { usuarioId: linha.id, ator: { papel, empresaIds } };
  }

  it("cliente da empresa reanalisa, com auditoria e autor gravados", async () => {
    const { empresa, leadId } = await cenario();
    const cliente = await usuario("cliente", [empresa.id]);

    const resultado = await reanalisarLead(db, motorFixo().motor, cliente, empresa.id, leadId);

    expect(resultado.situacao).toBe("concluida");
    const [analise] = await analisesDoLead(leadId);
    expect(analise?.solicitadaPor).toBe(cliente.usuarioId);
    const eventos = await db
      .select()
      .from(auditoria)
      .where(and(eq(auditoria.acao, "lead.reanalisado"), eq(auditoria.recursoId, leadId)));
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.detalhes).toEqual({ analiseId: analise?.id });
  });

  it("suporte não reanalisa (somente leitura)", async () => {
    const { empresa, leadId } = await cenario();
    const suporte = await usuario("suporte", []);

    await expect(
      reanalisarLead(db, motorFixo().motor, suporte, empresa.id, leadId),
    ).rejects.toBeInstanceOf(ErroProibido);
  });

  it("cliente de outra empresa recebe 404 (IDOR)", async () => {
    const { empresa, leadId } = await cenario();
    const outra = await criarEmpresaDeTeste(db);
    const estranho = await usuario("cliente", [outra.id]);

    await expect(
      reanalisarLead(db, motorFixo().motor, estranho, empresa.id, leadId),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
  });
});
