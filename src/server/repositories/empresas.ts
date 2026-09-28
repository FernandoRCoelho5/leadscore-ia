import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { empresas, type Empresa, type NovaEmpresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";

import { ehUuid } from "./utilitarios";

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
