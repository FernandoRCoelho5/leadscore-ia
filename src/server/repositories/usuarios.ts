import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { empresas, membrosEmpresa, usuarios, type Usuario } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";

import { ehUuid } from "./utilitarios";

/** Acesso a dados de usuários e dos seus vínculos com empresas. */

/** Usuário não excluído (o bloqueio é conferido por quem chama). */
export async function obterUsuarioAtivo(
  db: BancoDeDados,
  usuarioId: string,
): Promise<Usuario | undefined> {
  if (!ehUuid(usuarioId)) {
    return undefined;
  }
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), isNull(usuarios.deletedAt)))
    .limit(1);
  return usuario;
}

export async function atualizarNomeDoUsuario(
  db: BancoDeDados,
  usuarioId: string,
  nome: string,
): Promise<boolean> {
  const atualizados = await db
    .update(usuarios)
    .set({ nome })
    .where(and(eq(usuarios.id, usuarioId), isNull(usuarios.deletedAt)))
    .returning({ id: usuarios.id });
  return atualizados.length > 0;
}

export type VinculoDeEmpresa = {
  empresaId: string;
  nome: string;
  slug: string;
};

/** Empresas ativas das quais o usuário é membro (vínculo e empresa não excluídos). */
export async function listarEmpresasDoUsuario(
  db: BancoDeDados,
  usuarioId: string,
): Promise<VinculoDeEmpresa[]> {
  return db
    .select({ empresaId: empresas.id, nome: empresas.nome, slug: empresas.slug })
    .from(membrosEmpresa)
    .innerJoin(empresas, eq(empresas.id, membrosEmpresa.empresaId))
    .where(
      and(
        eq(membrosEmpresa.usuarioId, usuarioId),
        isNull(membrosEmpresa.deletedAt),
        isNull(empresas.deletedAt),
        eq(empresas.status, "ativa"),
      ),
    )
    .orderBy(asc(membrosEmpresa.createdAt));
}

export async function criarVinculo(
  db: BancoDeDados,
  usuarioId: string,
  empresaId: string,
): Promise<void> {
  await db.insert(membrosEmpresa).values({ usuarioId, empresaId, papel: "cliente" });
}
