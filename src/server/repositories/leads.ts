import "server-only";

import { and, count, desc, eq, gte, ilike, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";

import {
  analises,
  leads,
  type Classificacao,
  type Lead,
  type NovoLead,
  type StatusAnalise,
  type StatusLead,
} from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import {
  deslocamento,
  esquemaPaginacao,
  montarPagina,
  type Pagina,
  type Paginacao,
} from "@/lib/paginacao";

import { ehUuid, padraoDeBusca } from "./utilitarios";

/**
 * Acesso a dados dos leads.
 *
 * Regra de isolamento (D-002): toda função exige o `empresaId` e toda consulta
 * filtra por ele e por `deleted_at IS NULL`. O `empresaId` vem sempre da sessão
 * do usuário (ou do formulário público), nunca dos dados enviados pelo cliente.
 */

export type FiltrosDeLeads = {
  /** Trecho do nome, e-mail ou empresa do lead. */
  busca?: string;
  classificacao?: Classificacao;
  status?: StatusLead;
  /** Início do período (inclusive). */
  criadoDe?: Date;
  /** Fim do período (exclusive). */
  criadoAte?: Date;
  ordenarPor?: "criadoEm" | "score" | "nome";
  direcao?: "asc" | "desc";
};

/** Dados que o chamador pode informar; id, empresa e campos da análise são controlados aqui. */
export type DadosDeNovoLead = Omit<
  NovoLead,
  | "id"
  | "empresaId"
  | "statusAnalise"
  | "scoreAtual"
  | "classificacaoAtual"
  | "anonimizadoEm"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
>;

/** Condições aplicadas a toda consulta: empresa do usuário e registros não excluídos. */
function escopoDaEmpresa(empresaId: string): SQL[] {
  return [eq(leads.empresaId, empresaId), isNull(leads.deletedAt)];
}

const COLUNAS_DE_ORDENACAO = {
  criadoEm: leads.createdAt,
  score: leads.scoreAtual,
  nome: leads.nome,
} as const;

/** Condições da empresa e dos filtros; usadas pela lista e pela exportação. */
function condicoesDosFiltros(empresaId: string, filtros: FiltrosDeLeads): SQL[] {
  const condicoes = escopoDaEmpresa(empresaId);

  const termo = filtros.busca?.trim();
  if (termo) {
    const padrao = padraoDeBusca(termo);
    const busca = or(
      ilike(leads.nome, padrao),
      ilike(leads.email, padrao),
      ilike(leads.empresaNome, padrao),
    );
    if (busca) {
      condicoes.push(busca);
    }
  }
  if (filtros.classificacao) {
    condicoes.push(eq(leads.classificacaoAtual, filtros.classificacao));
  }
  if (filtros.status) {
    condicoes.push(eq(leads.status, filtros.status));
  }
  if (filtros.criadoDe) {
    condicoes.push(gte(leads.createdAt, filtros.criadoDe));
  }
  if (filtros.criadoAte) {
    condicoes.push(lt(leads.createdAt, filtros.criadoAte));
  }
  return condicoes;
}

export async function listarLeads(
  db: BancoDeDados,
  empresaId: string,
  filtros: FiltrosDeLeads = {},
  paginacao: Partial<Paginacao> = {},
): Promise<Pagina<Lead>> {
  const pagina = esquemaPaginacao.parse(paginacao);
  const filtro = and(...condicoesDosFiltros(empresaId, filtros));
  // Só colunas da lista; um valor inesperado cai na ordenação padrão.
  const coluna = COLUNAS_DE_ORDENACAO[filtros.ordenarPor ?? "criadoEm"] ?? leads.createdAt;
  // NULLS LAST: leads ainda sem score ficam no fim; o id desempata e deixa a paginação estável.
  const ordem =
    filtros.direcao === "asc" ? sql`${coluna} ASC NULLS LAST` : sql`${coluna} DESC NULLS LAST`;

  const [itens, [linhaDoTotal]] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(filtro)
      .orderBy(ordem, desc(leads.id))
      .limit(pagina.porPagina)
      .offset(deslocamento(pagina)),
    db.select({ total: count() }).from(leads).where(filtro),
  ]);

  return montarPagina(itens, linhaDoTotal?.total ?? 0, pagina);
}

export async function obterLead(
  db: BancoDeDados,
  empresaId: string,
  leadId: string,
): Promise<Lead | undefined> {
  if (!ehUuid(leadId)) {
    return undefined;
  }
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), ...escopoDaEmpresa(empresaId)))
    .limit(1);
  return lead;
}

/**
 * Os campos são copiados um a um (lista de permitidos), e não com `...dados`:
 * mesmo que chegue um objeto com campos extras (id, deletedAt, scoreAtual...),
 * nada além do previsto vai para o banco (proteção contra "mass assignment").
 */
export async function criarLead(
  db: BancoDeDados,
  empresaId: string,
  dados: DadosDeNovoLead,
): Promise<Lead> {
  const [lead] = await db
    .insert(leads)
    .values({
      empresaId,
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      empresaNome: dados.empresaNome,
      segmento: dados.segmento,
      mensagem: dados.mensagem,
      origem: dados.origem,
      status: dados.status,
      consentimentoLgpd: dados.consentimentoLgpd,
      consentimentoEm: dados.consentimentoEm,
      consentimentoVersaoTexto: dados.consentimentoVersaoTexto,
      ipHash: dados.ipHash,
    })
    .returning();
  if (!lead) {
    throw new Error("O banco não devolveu o lead inserido.");
  }
  return lead;
}

export async function atualizarStatusDoLead(
  db: BancoDeDados,
  empresaId: string,
  leadId: string,
  status: StatusLead,
): Promise<Lead | undefined> {
  if (!ehUuid(leadId)) {
    return undefined;
  }
  const [lead] = await db
    .update(leads)
    .set({ status })
    .where(and(eq(leads.id, leadId), ...escopoDaEmpresa(empresaId)))
    .returning();
  return lead;
}

/** Atualiza o andamento da análise (pendente, processando, falhou, limite_atingido). */
export async function atualizarStatusDaAnalise(
  db: BancoDeDados,
  empresaId: string,
  leadId: string,
  statusAnalise: StatusAnalise,
): Promise<boolean> {
  if (!ehUuid(leadId)) {
    return false;
  }
  const atualizados = await db
    .update(leads)
    .set({ statusAnalise })
    .where(and(eq(leads.id, leadId), ...escopoDaEmpresa(empresaId)))
    .returning({ id: leads.id });
  return atualizados.length > 0;
}

/** Depois disso, uma análise "processando" é considerada interrompida e pode ser retomada. */
export const ANALISE_TRAVADA_APOS_MS = 5 * 60 * 1000;

/**
 * Reserva o lead para uma análise, marcando `processando` numa única instrução:
 * dois pedidos ao mesmo tempo (ex.: dois cliques em "Reanalisar") nunca
 * analisam o mesmo lead duas vezes. Uma análise interrompida (a função foi
 * encerrada no meio) libera o lead depois de 5 minutos. Devolve `undefined`
 * se o lead não existir ou já estiver em análise.
 */
export async function reservarLeadParaAnalise(
  db: BancoDeDados,
  empresaId: string,
  leadId: string,
  agora: Date = new Date(),
): Promise<Lead | undefined> {
  if (!ehUuid(leadId)) {
    return undefined;
  }
  const travadaAntesDe = new Date(agora.getTime() - ANALISE_TRAVADA_APOS_MS);
  const [lead] = await db
    .update(leads)
    .set({ statusAnalise: "processando", updatedAt: agora })
    .where(
      and(
        eq(leads.id, leadId),
        ...escopoDaEmpresa(empresaId),
        or(ne(leads.statusAnalise, "processando"), lt(leads.updatedAt, travadaAntesDe)),
      ),
    )
    .returning();
  return lead;
}

/** Tamanho de cada lote lido do banco na exportação (memória constante). */
export const TAMANHO_DO_LOTE_DE_EXPORTACAO = 500;

/**
 * Leads para exportar em CSV, em lotes, do mais novo para o mais antigo.
 * Paginação por "cursor" (id menor que o último lido), e não por OFFSET: cada
 * lote custa o mesmo, mesmo com dezenas de milhares de leads. Os ids são
 * UUID v7, que crescem com o tempo de criação.
 */
export async function* lotesDeLeadsParaExportar(
  db: BancoDeDados,
  empresaId: string,
  filtros: FiltrosDeLeads = {},
  tamanhoDoLote: number = TAMANHO_DO_LOTE_DE_EXPORTACAO,
): AsyncGenerator<Lead[]> {
  const condicoes = condicoesDosFiltros(empresaId, filtros);
  let ultimoId: string | undefined;
  for (;;) {
    const lote = await db
      .select()
      .from(leads)
      .where(and(...condicoes, ultimoId ? lt(leads.id, ultimoId) : undefined))
      .orderBy(desc(leads.id))
      .limit(tamanhoDoLote);
    if (lote.length === 0) {
      return;
    }
    yield lote;
    if (lote.length < tamanhoDoLote) {
      return;
    }
    ultimoId = lote[lote.length - 1]?.id;
  }
}

export type ResumoDosLeads = {
  total: number;
  doPeriodo: number;
  porClassificacao: Record<Classificacao | "semAnalise", number>;
  porStatus: Record<StatusLead, number>;
};

/**
 * Números da visão geral numa única consulta (COUNT ... FILTER): o total, os
 * recebidos desde `desde` e, entre eles, a classificação; o andamento
 * (status) considera todos os leads da empresa.
 */
export async function resumirLeads(
  db: BancoDeDados,
  empresaId: string,
  desde: Date,
): Promise<ResumoDosLeads> {
  const noPeriodo = sql`${leads.createdAt} >= ${desde.toISOString()}::timestamptz`;
  const contar = (condicao: SQL) =>
    sql<number>`count(*) filter (where ${condicao})`.mapWith(Number);
  const [linha] = await db
    .select({
      total: count(),
      doPeriodo: contar(noPeriodo),
      quente: contar(sql`${noPeriodo} and ${leads.classificacaoAtual} = 'quente'`),
      morno: contar(sql`${noPeriodo} and ${leads.classificacaoAtual} = 'morno'`),
      frio: contar(sql`${noPeriodo} and ${leads.classificacaoAtual} = 'frio'`),
      semAnalise: contar(sql`${noPeriodo} and ${leads.classificacaoAtual} is null`),
      novo: contar(sql`${leads.status} = 'novo'`),
      emContato: contar(sql`${leads.status} = 'em_contato'`),
      ganho: contar(sql`${leads.status} = 'ganho'`),
      perdido: contar(sql`${leads.status} = 'perdido'`),
    })
    .from(leads)
    .where(and(...escopoDaEmpresa(empresaId)));

  return {
    total: linha?.total ?? 0,
    doPeriodo: linha?.doPeriodo ?? 0,
    porClassificacao: {
      quente: linha?.quente ?? 0,
      morno: linha?.morno ?? 0,
      frio: linha?.frio ?? 0,
      semAnalise: linha?.semAnalise ?? 0,
    },
    porStatus: {
      novo: linha?.novo ?? 0,
      em_contato: linha?.emContato ?? 0,
      ganho: linha?.ganho ?? 0,
      perdido: linha?.perdido ?? 0,
    },
  };
}

export const TEXTO_DA_MENSAGEM_ANONIMIZADA = "[removido a pedido do titular]";
export const NOME_ANONIMIZADO = "Titular anonimizado";
const TEXTO_DA_ANALISE_ANONIMIZADA = "[removido]";

/**
 * Anonimização pela LGPD (D-012), irreversível: apaga os dados pessoais do
 * lead e os textos das análises dele, mantendo o que serve à estatística
 * (segmento, status, nota, classificação e datas). Numa transação: ou tudo
 * muda, ou nada. Devolve `false` se o lead não existir ou já estiver anonimizado.
 */
export async function anonimizarLead(
  db: BancoDeDados,
  empresaId: string,
  leadId: string,
  agora: Date = new Date(),
): Promise<boolean> {
  if (!ehUuid(leadId)) {
    return false;
  }
  return db.transaction(async (tx) => {
    const atualizados = await tx
      .update(leads)
      .set({
        nome: NOME_ANONIMIZADO,
        email: null,
        telefone: null,
        empresaNome: null,
        ipHash: null,
        mensagem: TEXTO_DA_MENSAGEM_ANONIMIZADA,
        anonimizadoEm: agora,
      })
      .where(and(eq(leads.id, leadId), ...escopoDaEmpresa(empresaId), isNull(leads.anonimizadoEm)))
      .returning({ id: leads.id });
    if (atualizados.length === 0) {
      return false;
    }
    await tx
      .update(analises)
      .set({
        justificativa: TEXTO_DA_ANALISE_ANONIMIZADA,
        respostaSugerida: TEXTO_DA_ANALISE_ANONIMIZADA,
      })
      .where(and(eq(analises.leadId, leadId), eq(analises.empresaId, empresaId)));
    return true;
  });
}

/** Exclusão lógica: marca `deleted_at`; o registro continua no banco. */
export async function excluirLead(
  db: BancoDeDados,
  empresaId: string,
  leadId: string,
): Promise<boolean> {
  if (!ehUuid(leadId)) {
    return false;
  }
  const excluidos = await db
    .update(leads)
    .set({ deletedAt: new Date() })
    .where(and(eq(leads.id, leadId), ...escopoDaEmpresa(empresaId)))
    .returning({ id: leads.id });
  return excluidos.length > 0;
}
