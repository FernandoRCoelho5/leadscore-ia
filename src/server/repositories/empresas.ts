import "server-only";

import { and, eq, isNull } from "drizzle-orm";

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

export async function criarEmpresa(db: BancoDeDados, dados: DadosDeNovaEmpresa): Promise<Empresa> {
  const [empresa] = await db.insert(empresas).values(dados).returning();
  if (!empresa) {
    throw new Error("O banco não devolveu a empresa inserida.");
  }
  return empresa;
}
