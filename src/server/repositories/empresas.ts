import "server-only";

import { and, asc, count, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

import { empresas, usoMensal, type Empresa, type NovaEmpresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import {
  deslocamento,
  esquemaPaginacao,
  montarPagina,
  type Pagina,
  type Paginacao,
} from "@/lib/paginacao";

import { ehUuid, padraoDeBusca } from "./utilitarios";

/** Acesso a dados das empresas clientes (os "tenants" do SaaS). */

export type DadosDeNovaEmpresa = Omit<NovaEmpresa, "id" | "createdAt" | "updatedAt" | "deletedAt">;

export async function obterEmpresa(
  db: BancoDeDados,
  empresaId: string,
): Promise<Empresa | undefined> {
  if (!ehUuid(empresaId)) {
    return undefined;
  }
  const [empresa] = await db
    .select()
    .from(empresas)
    .where(and(eq(empresas.id, empresaId), isNull(empresas.deletedAt)))
    .limit(1);
  return empresa;
}

/** Usado pelo formulário público: só empresas ativas e não excluídas recebem leads. */
export async function obterEmpresaAtivaPorSlug(
  db: BancoDeDados,
  slug: string,
): Promise<Empresa | undefined> {
  const [empresa] = await db
    .select()
    .from(empresas)
    .where(and(eq(empresas.slug, slug), eq(empresas.status, "ativa"), isNull(empresas.deletedAt)))
    .limit(1);
  return empresa;
}

/** O slug já é usado por outra empresa não excluída? */
export async function slugEmUso(db: BancoDeDados, slug: string): Promise<boolean> {
  const [existente] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(and(eq(empresas.slug, slug), isNull(empresas.deletedAt)))
    .limit(1);
  return existente !== undefined;
}

export type DadosDoPerfilDaEmpresa = Pick<
  NovaEmpresa,
  "descricao" | "produtosServicos" | "clienteIdeal" | "ticketMedioCentavos" | "regioesAtendidas"
>;

/**
 * Atualiza o perfil do negócio e incrementa `perfil_versao` (cada análise da IA
 * guarda a versão do perfil que usou).
 */
export async function atualizarPerfilDaEmpresa(
  db: BancoDeDados,
  empresaId: string,
  dados: DadosDoPerfilDaEmpresa,
): Promise<Empresa | undefined> {
  if (!ehUuid(empresaId)) {
    return undefined;
  }
  const [empresa] = await db
    .update(empresas)
    .set({
      descricao: dados.descricao,
      produtosServicos: dados.produtosServicos,
      clienteIdeal: dados.clienteIdeal,
      ticketMedioCentavos: dados.ticketMedioCentavos,
      regioesAtendidas: dados.regioesAtendidas,
      perfilVersao: sql`${empresas.perfilVersao} + 1`,
    })
    .where(and(eq(empresas.id, empresaId), isNull(empresas.deletedAt)))
    .returning();
  return empresa;
}

export async function criarEmpresa(db: BancoDeDados, dados: DadosDeNovaEmpresa): Promise<Empresa> {
  const [empresa] = await db.insert(empresas).values(dados).returning();
  if (!empresa) {
    throw new Error("O banco não devolveu a empresa inserida.");
  }
  return empresa;
}

export type FiltrosDeEmpresas = { busca?: string; situacao?: "ativa" | "bloqueada" };

export type EmpresaNaLista = Empresa & { leadsNoMes: number; analisesNoMes: number };

/**
 * Lista da administração (equipe Brasa), com o uso do mês de cada empresa.
 * A contagem de leads é uma subconsulta por linha, que usa o índice
 * (empresa_id, created_at): barata, porque a página tem no máximo 100 linhas.
 */
export async function listarEmpresas(
  db: BancoDeDados,
  filtros: FiltrosDeEmpresas,
  paginacao: Partial<Paginacao>,
  inicioDoMes: Date,
  competencia: string,
): Promise<Pagina<EmpresaNaLista>> {
  const pagina = esquemaPaginacao.parse(paginacao);
  const condicoes: SQL[] = [isNull(empresas.deletedAt)];
  const termo = filtros.busca?.trim();
  if (termo) {
    const busca = or(
      ilike(empresas.nome, padraoDeBusca(termo)),
      ilike(empresas.slug, padraoDeBusca(termo)),
    );
    if (busca) {
      condicoes.push(busca);
    }
  }
  if (filtros.situacao) {
    condicoes.push(eq(empresas.status, filtros.situacao));
  }
  const filtro = and(...condicoes);

  const [linhas, [linhaDoTotal]] = await Promise.all([
    db
      .select({
        empresa: empresas,
        // Apelido explícito (l): a subconsulta não pode confundir as colunas de
        // "leads" com as de "empresas" (o Drizzle não qualifica colunas no SELECT).
        leadsNoMes: sql<number>`(
          select count(*) from leads l
          where l.empresa_id = "empresas"."id"
            and l.deleted_at is null
            and l.created_at >= ${inicioDoMes.toISOString()}::timestamptz
        )`.mapWith(Number),
        analisesNoMes: sql<number>`coalesce(${usoMensal.analises}, 0)`.mapWith(Number),
      })
      .from(empresas)
      .leftJoin(
        usoMensal,
        and(eq(usoMensal.empresaId, empresas.id), eq(usoMensal.competencia, competencia)),
      )
      .where(filtro)
      .orderBy(asc(empresas.nome), asc(empresas.id))
      .limit(pagina.porPagina)
      .offset(deslocamento(pagina)),
    db.select({ total: count() }).from(empresas).where(filtro),
  ]);

  const itens = linhas.map(({ empresa, leadsNoMes, analisesNoMes }) => ({
    ...empresa,
    leadsNoMes,
    analisesNoMes,
  }));
  return montarPagina(itens, linhaDoTotal?.total ?? 0, pagina);
}

/** Bloqueia ou reativa a empresa (bloqueada: o formulário público para de receber leads). */
export async function alterarSituacaoDaEmpresa(
  db: BancoDeDados,
  empresaId: string,
  situacao: "ativa" | "bloqueada",
): Promise<Empresa | undefined> {
  if (!ehUuid(empresaId)) {
    return undefined;
  }
  const [empresa] = await db
    .update(empresas)
    .set({ status: situacao })
    .where(and(eq(empresas.id, empresaId), isNull(empresas.deletedAt)))
    .returning();
  return empresa;
}

export async function alterarLimiteDaEmpresa(
  db: BancoDeDados,
  empresaId: string,
  limiteAnalisesMes: number,
): Promise<Empresa | undefined> {
  if (!ehUuid(empresaId)) {
    return undefined;
  }
  const [empresa] = await db
    .update(empresas)
    .set({ limiteAnalisesMes })
    .where(and(eq(empresas.id, empresaId), isNull(empresas.deletedAt)))
    .returning();
  return empresa;
}
