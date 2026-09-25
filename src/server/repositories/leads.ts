import "server-only";

import { and, count, desc, eq, gte, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";

import {
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

export async function listarLeads(
  db: BancoDeDados,
  empresaId: string,
  filtros: FiltrosDeLeads = {},
  paginacao: Partial<Paginacao> = {},
): Promise<Pagina<Lead>> {
  const pagina = esquemaPaginacao.parse(paginacao);
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

  const filtro = and(...condicoes);
  const coluna = COLUNAS_DE_ORDENACAO[filtros.ordenarPor ?? "criadoEm"];
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

export async function criarLead(
  db: BancoDeDados,
  empresaId: string,
  dados: DadosDeNovoLead,
): Promise<Lead> {
  const [lead] = await db
    .insert(leads)
    .values({ ...dados, empresaId })
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
