import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { analises, auditoria, empresas, leads, usuarios, type Empresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { ErroConflito, ErroNaoEncontrado, ErroProibido, ErroValidacao } from "@/lib/erros";
import type { Papel } from "@/server/auth/permissoes";
import { registrarAnalise } from "@/server/repositories/analises";
import { lotesDaAuditoriaParaExportar } from "@/server/repositories/auditoria";
import { criarLead, lotesDeLeadsParaExportar } from "@/server/repositories/leads";
import { consumirAnalise } from "@/server/repositories/usoMensal";
import {
  abrirEmpresaParaEquipe,
  alterarBloqueioNaPlataforma,
  alterarLimiteDeAnalises,
  alterarSituacaoDaEmpresaNaPlataforma,
  consultarAuditoria,
  exportarAuditoria,
  listarEmpresasDaPlataforma,
  listarUsuariosDaPlataforma,
  registrarExportacaoDaAdministracao,
  todasAsPaginas,
} from "@/server/services/administracao";
import type { ContextoDoUsuario } from "@/server/services/contexto";
import {
  alterarStatusDoLead,
  anonimizarLeadDaEmpresa,
  excluirLeadDaEmpresa,
  exportarLeadsDaEmpresa,
  listarLeadsDaEmpresa,
  obterDetalheDoLead,
} from "@/server/services/leads";
import { visaoGeralDaEmpresa, visaoGeralDaPlataforma } from "@/server/services/painel";

import { criarBancoDeTeste, criarEmpresaDeTeste } from "./banco";

/** Painel (leads, visão geral) e administração com o banco real (PGlite). */

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
});

afterAll(async () => {
  await encerrar();
});

let sequencia = 0;

async function novoUsuario(papel: Papel, empresaIds: string[] = []): Promise<ContextoDoUsuario> {
  sequencia += 1;
  const [usuario] = await db
    .insert(usuarios)
    .values({
      nome: `Pessoa ${sequencia}`,
      email: `pessoa-painel-${sequencia}@teste.example`,
      papelPlataforma: papel === "cliente" ? null : papel,
    })
    .returning();
  if (!usuario) {
    throw new Error("usuário não criado");
  }
  return { usuarioId: usuario.id, ator: { papel, empresaIds } };
}

async function novoLead(empresa: Empresa, dados: Partial<Parameters<typeof criarLead>[2]> = {}) {
  sequencia += 1;
  return criarLead(db, empresa.id, {
    nome: `Lead ${sequencia}`,
    email: `lead${sequencia}@cliente.example`,
    telefone: "(24) 99999-0000",
    empresaNome: "Metalúrgica Teste",
    segmento: "Indústria",
    mensagem: "Quero um orçamento de site.",
    consentimentoLgpd: true,
    consentimentoEm: new Date(),
    ...dados,
  });
}

async function analisar(empresa: Empresa, leadId: string, score: number) {
  await registrarAnalise(db, empresa.id, leadId, {
    score,
    classificacao: score >= 70 ? "quente" : score >= 40 ? "morno" : "frio",
    justificativa: "Pediu orçamento com prazo.",
    respostaSugerida: "Olá! Obrigado pelo contato.",
    modelo: "mock",
    promptVersion: "v1",
    perfilVersao: 1,
    tokensEntrada: 0,
    tokensSaida: 0,
    tempoRespostaMs: 1,
    mock: true,
  });
}

async function eventos(acao: string, recursoId?: string) {
  return db
    .select()
    .from(auditoria)
    .where(
      recursoId
        ? and(eq(auditoria.acao, acao), eq(auditoria.recursoId, recursoId))
        : eq(auditoria.acao, acao),
    );
}

async function cenario() {
  const empresa = await criarEmpresaDeTeste(db);
  const cliente = await novoUsuario("cliente", [empresa.id]);
  return { empresa, cliente };
}

describe("lista de leads", () => {
  it("filtra por busca, classificação e status, com paginação", async () => {
    const { empresa, cliente } = await cenario();
    const alvo = await novoLead(empresa, { nome: "Joana Prado" });
    await analisar(empresa, alvo.id, 85);
    for (let i = 0; i < 3; i += 1) {
      await novoLead(empresa);
    }

    const busca = await listarLeadsDaEmpresa(db, cliente, empresa.id, { busca: "prado" }, {});
    const quentes = await listarLeadsDaEmpresa(
      db,
      cliente,
      empresa.id,
      { classificacao: "quente" },
      {},
    );
    const pagina2 = await listarLeadsDaEmpresa(
      db,
      cliente,
      empresa.id,
      {},
      { pagina: 2, porPagina: 3 },
    );

    expect(busca.itens.map((l) => l.id)).toEqual([alvo.id]);
    expect(quentes.total).toBe(1);
    expect(pagina2).toMatchObject({ total: 4, totalPaginas: 2, pagina: 2 });
    expect(pagina2.itens).toHaveLength(1);
  });

  it("cliente de outra empresa não vê a lista (404); o suporte vê", async () => {
    const { empresa } = await cenario();
    const intruso = await novoUsuario("cliente", [(await criarEmpresaDeTeste(db)).id]);
    const suporte = await novoUsuario("suporte");

    await expect(listarLeadsDaEmpresa(db, intruso, empresa.id, {}, {})).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    );
    await expect(listarLeadsDaEmpresa(db, suporte, empresa.id, {}, {})).resolves.toMatchObject({
      total: 0,
    });
  });
});

describe("detalhe do lead", () => {
  it("traz o histórico de análises; o acesso da equipe vai para a auditoria", async () => {
    const { empresa, cliente } = await cenario();
    const lead = await novoLead(empresa);
    await analisar(empresa, lead.id, 30);
    await analisar(empresa, lead.id, 75);
    const suporte = await novoUsuario("suporte");

    const doCliente = await obterDetalheDoLead(db, cliente, empresa.id, lead.id);
    expect(doCliente.analises.map((a) => a.score)).toEqual([75, 30]);
    expect(await eventos("lead.visualizado", lead.id)).toHaveLength(0);

    await obterDetalheDoLead(db, suporte, empresa.id, lead.id);
    const [evento] = await eventos("lead.visualizado", lead.id);
    expect(evento?.atorId).toBe(suporte.usuarioId);
  });

  it("lead de outra empresa: não encontrado", async () => {
    const { cliente } = await cenario();
    const outra = await criarEmpresaDeTeste(db);
    const lead = await novoLead(outra);

    await expect(
      obterDetalheDoLead(db, cliente, cliente.ator.empresaIds[0] ?? "", lead.id),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
  });
});

describe("ações sobre o lead", () => {
  it("altera o status e registra de onde para onde", async () => {
    const { empresa, cliente } = await cenario();
    const lead = await novoLead(empresa);

    const atualizado = await alterarStatusDoLead(db, cliente, empresa.id, lead.id, "em_contato");

    expect(atualizado.status).toBe("em_contato");
    const [evento] = await eventos("lead.status_alterado", lead.id);
    expect(evento?.detalhes).toEqual({ de: "novo", para: "em_contato" });
  });

  it("o suporte não altera nada (somente leitura)", async () => {
    const { empresa } = await cenario();
    const lead = await novoLead(empresa);
    const suporte = await novoUsuario("suporte");

    await expect(
      alterarStatusDoLead(db, suporte, empresa.id, lead.id, "ganho"),
    ).rejects.toBeInstanceOf(ErroProibido);
    await expect(excluirLeadDaEmpresa(db, suporte, empresa.id, lead.id)).rejects.toBeInstanceOf(
      ErroProibido,
    );
  });

  it("exclusão lógica: some da lista, mas continua no banco", async () => {
    const { empresa, cliente } = await cenario();
    const lead = await novoLead(empresa);

    await excluirLeadDaEmpresa(db, cliente, empresa.id, lead.id);

    expect((await listarLeadsDaEmpresa(db, cliente, empresa.id, {}, {})).total).toBe(0);
    const [noBanco] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(noBanco?.deletedAt).toBeInstanceOf(Date);
    expect(await eventos("lead.excluido", lead.id)).toHaveLength(1);
  });

  it("anonimização (LGPD): exige a palavra de confirmação", async () => {
    const { empresa, cliente } = await cenario();
    const lead = await novoLead(empresa);

    await expect(
      anonimizarLeadDaEmpresa(db, cliente, empresa.id, lead.id, "sim"),
    ).rejects.toBeInstanceOf(ErroValidacao);
  });

  it("anonimização apaga os dados pessoais e os textos das análises, e não se repete", async () => {
    const { empresa, cliente } = await cenario();
    const lead = await novoLead(empresa, { nome: "Carla Dias", mensagem: "Meu CPF é 123." });
    await analisar(empresa, lead.id, 80);

    await anonimizarLeadDaEmpresa(db, cliente, empresa.id, lead.id, " anonimizar ");

    const [anonimo] = await db.select().from(leads).where(eq(leads.id, lead.id));
    expect(anonimo).toMatchObject({
      nome: "Titular anonimizado",
      email: null,
      telefone: null,
      empresaNome: null,
      ipHash: null,
      mensagem: "[removido a pedido do titular]",
      // Mantém o que serve à estatística.
      segmento: "Indústria",
      scoreAtual: 80,
      classificacaoAtual: "quente",
    });
    expect(anonimo?.anonimizadoEm).toBeInstanceOf(Date);
    const [analise] = await db.select().from(analises).where(eq(analises.leadId, lead.id));
    expect(analise).toMatchObject({ justificativa: "[removido]", respostaSugerida: "[removido]" });
    expect(await eventos("lead.anonimizado", lead.id)).toHaveLength(1);

    await expect(
      anonimizarLeadDaEmpresa(db, cliente, empresa.id, lead.id, "ANONIMIZAR"),
    ).rejects.toBeInstanceOf(ErroConflito);
  });
});

describe("exportação de leads", () => {
  it("lê em lotes pelo cursor, sem repetir nem pular leads", async () => {
    const { empresa } = await cenario();
    const criados = [];
    for (let i = 0; i < 5; i += 1) {
      criados.push(await novoLead(empresa));
    }

    const ids = [];
    for await (const lote of lotesDeLeadsParaExportar(db, empresa.id, {}, 2)) {
      expect(lote.length).toBeLessThanOrEqual(2);
      ids.push(...lote.map((l) => l.id));
    }

    expect(ids).toHaveLength(5);
    expect(new Set(ids)).toEqual(new Set(criados.map((l) => l.id)));
  });

  it("registra a exportação sem guardar o texto da busca; o suporte não exporta", async () => {
    const { empresa, cliente } = await cenario();
    const suporte = await novoUsuario("suporte");

    await exportarLeadsDaEmpresa(db, cliente, empresa.id, {
      busca: "maria@cliente.example",
      classificacao: "quente",
    });

    const [evento] = await db
      .select()
      .from(auditoria)
      .where(and(eq(auditoria.acao, "leads.exportados"), eq(auditoria.empresaId, empresa.id)));
    expect(evento?.detalhes).toMatchObject({ comBusca: true, classificacao: "quente" });
    expect(JSON.stringify(evento?.detalhes)).not.toContain("maria");
    await expect(exportarLeadsDaEmpresa(db, suporte, empresa.id, {})).rejects.toBeInstanceOf(
      ErroProibido,
    );
  });
});

describe("visão geral", () => {
  it("conta os leads do mês por classificação, o andamento e o consumo de análises", async () => {
    const { empresa, cliente } = await cenario();
    const quente = await novoLead(empresa);
    await analisar(empresa, quente.id, 90);
    const frio = await novoLead(empresa);
    await analisar(empresa, frio.id, 10);
    await novoLead(empresa, { status: "ganho" });
    await consumirAnalise(db, empresa.id, empresa.limiteAnalisesMes);

    const visao = await visaoGeralDaEmpresa(db, cliente, empresa.id);

    expect(visao.leads).toMatchObject({
      total: 3,
      doPeriodo: 3,
      porClassificacao: { quente: 1, morno: 0, frio: 1, semAnalise: 1 },
      porStatus: { novo: 2, em_contato: 0, ganho: 1, perdido: 0 },
    });
    expect(visao.analisesUsadas).toBe(1);
    expect(visao.limiteDeAnalises).toBe(100);
    expect(visao.quentesRecentes.map((l) => l.id)).toEqual([quente.id]);
  });

  it("a visão da plataforma é só da equipe", async () => {
    const { cliente } = await cenario();
    const admin = await novoUsuario("admin");

    await expect(visaoGeralDaPlataforma(db, cliente)).rejects.toBeInstanceOf(ErroProibido);
    const resumo = await visaoGeralDaPlataforma(db, admin);
    expect(resumo.empresasAtivas).toBeGreaterThan(0);
  });
});

describe("administração", () => {
  it("a equipe abre uma empresa (auditado); o cliente não", async () => {
    const { empresa, cliente } = await cenario();
    const suporte = await novoUsuario("suporte");

    await expect(abrirEmpresaParaEquipe(db, cliente, empresa.id)).rejects.toBeInstanceOf(
      ErroProibido,
    );
    await abrirEmpresaParaEquipe(db, suporte, empresa.id);

    const [evento] = await eventos("empresa.acessada", empresa.id);
    expect(evento?.atorId).toBe(suporte.usuarioId);
  });

  it("lista empresas com os leads e as análises do mês", async () => {
    const { empresa } = await cenario();
    await novoLead(empresa);
    await novoLead(empresa);
    await consumirAnalise(db, empresa.id, 100);
    const admin = await novoUsuario("admin");

    const pagina = await listarEmpresasDaPlataforma(db, admin, { busca: empresa.slug }, {});

    expect(pagina.itens).toEqual([
      expect.objectContaining({ id: empresa.id, leadsNoMes: 2, analisesNoMes: 1 }),
    ]);
  });

  it("só o admin bloqueia e muda o limite, sempre com auditoria", async () => {
    const { empresa } = await cenario();
    const admin = await novoUsuario("admin");
    const suporte = await novoUsuario("suporte");

    await expect(
      alterarSituacaoDaEmpresaNaPlataforma(db, suporte, empresa.id, "bloqueada"),
    ).rejects.toBeInstanceOf(ErroProibido);
    await alterarSituacaoDaEmpresaNaPlataforma(db, admin, empresa.id, "bloqueada");
    await alterarLimiteDeAnalises(db, admin, empresa.id, 250);

    const [atualizada] = await db.select().from(empresas).where(eq(empresas.id, empresa.id));
    expect(atualizada).toMatchObject({ status: "bloqueada", limiteAnalisesMes: 250 });
    expect(await eventos("empresa.bloqueada", empresa.id)).toHaveLength(1);
    const [limite] = await eventos("empresa.limite_alterado", empresa.id);
    expect(limite?.detalhes).toEqual({ de: 100, para: 250 });
    await expect(alterarLimiteDeAnalises(db, admin, empresa.id, -1)).rejects.toBeInstanceOf(
      ErroValidacao,
    );
  });

  it("lista usuários por papel e situação; o admin bloqueia outros, nunca a si mesmo", async () => {
    const admin = await novoUsuario("admin");
    const alvo = await novoUsuario("cliente");

    await alterarBloqueioNaPlataforma(db, admin, alvo.usuarioId, true);
    const bloqueados = await listarUsuariosDaPlataforma(
      db,
      admin,
      { situacao: "bloqueado", papel: "cliente" },
      {},
    );

    expect(bloqueados.itens.map((u) => u.id)).toContain(alvo.usuarioId);
    expect(bloqueados.itens.every((u) => u.papelPlataforma === null)).toBe(true);
    expect(await eventos("usuario.bloqueado", alvo.usuarioId)).toHaveLength(1);
    await expect(
      alterarBloqueioNaPlataforma(db, admin, admin.usuarioId, true),
    ).rejects.toBeInstanceOf(ErroConflito);
  });

  it("consulta a auditoria por ação e registra as exportações da administração", async () => {
    const admin = await novoUsuario("admin");
    const { cliente } = await cenario();

    await registrarExportacaoDaAdministracao(db, admin, "usuarios", { comBusca: false });
    const pagina = await consultarAuditoria(db, admin, { acao: "usuarios.exportados" }, {});

    expect(pagina.itens[0]).toMatchObject({
      acao: "usuarios.exportados",
      atorEmail: `pessoa-painel-${sequencia - 1}@teste.example`,
    });
    await expect(consultarAuditoria(db, cliente, {}, {})).rejects.toBeInstanceOf(ErroProibido);
  });

  it("a auditoria é exportada por cursor, sem repetir nem pular eventos", async () => {
    const { empresa } = await cenario();
    const suporte = await novoUsuario("suporte");
    for (let vez = 0; vez < 7; vez += 1) {
      await abrirEmpresaParaEquipe(db, suporte, empresa.id);
    }

    const lotes: string[][] = [];
    for await (const lote of lotesDaAuditoriaParaExportar(db, { acao: "empresa.acessada" }, 3)) {
      lotes.push(lote.map((evento) => evento.id));
    }

    const { total } = await consultarAuditoria(db, suporte, { acao: "empresa.acessada" }, {});
    const ids = lotes.flat();
    expect(total).toBeGreaterThanOrEqual(7);
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
    expect(lotes.every((lote) => lote.length <= 3)).toBe(true);
    // Do mais novo para o mais antigo (UUID v7 cresce com o tempo).
    expect(ids).toEqual([...ids].sort().reverse());
  });

  it("exportar a auditoria vira um evento com os filtros; o cliente não exporta", async () => {
    const { cliente } = await cenario();
    const suporte = await novoUsuario("suporte");
    const desde = new Date("2026-09-01T03:00:00Z");

    const lotes = await exportarAuditoria(db, suporte, { acao: "auth.login", desde });
    await lotes.return(undefined);

    const exportacoes = await eventos("auditoria.exportada");
    expect(exportacoes.find((evento) => evento.atorId === suporte.usuarioId)?.detalhes).toEqual({
      acao: "auth.login",
      de: desde.toISOString(),
      ate: null,
    });
    await expect(exportarAuditoria(db, cliente, {})).rejects.toBeInstanceOf(ErroProibido);
  });

  it("todasAsPaginas percorre a lista inteira para o CSV", async () => {
    const admin = await novoUsuario("admin");

    const linhas = [];
    for await (const lote of todasAsPaginas((paginacao) =>
      listarUsuariosDaPlataforma(db, admin, {}, paginacao),
    )) {
      linhas.push(...lote);
    }

    const { total } = await listarUsuariosDaPlataforma(db, admin, {}, {});
    expect(linhas).toHaveLength(total);
    expect(new Set(linhas.map((usuario) => usuario.id)).size).toBe(total);
  });

  it("todasAsPaginas pede as páginas em ordem até a última", async () => {
    const pedidas: number[] = [];
    const lotes: number[][] = [];

    for await (const lote of todasAsPaginas(async ({ pagina, porPagina }) => {
      pedidas.push(pagina);
      const itens = pagina < 3 ? Array.from({ length: porPagina }, () => pagina) : [3];
      return { itens, total: 201, pagina, porPagina, totalPaginas: 3 };
    })) {
      lotes.push(lote);
    }

    expect(pedidas).toEqual([1, 2, 3]);
    expect(lotes.flat()).toHaveLength(201);
  });
});
