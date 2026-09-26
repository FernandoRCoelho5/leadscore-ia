import "server-only";

import { and, count, eq, gte } from "drizzle-orm";

import { auditoria, type EventoDeAuditoria } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";

/**
 * Registro de ações sensíveis (anonimização, exportação, exclusão lógica,
 * alteração de perfil...). Só inserções: a auditoria nunca é alterada.
 * Regra: `detalhes` não pode conter dados pessoais (nome, e-mail, telefone).
 */

export type NovoEventoDeAuditoria = Omit<
  EventoDeAuditoria,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;

export async function registrarAuditoria(
  db: BancoDeDados,
  evento: NovoEventoDeAuditoria,
): Promise<void> {
  await db.insert(auditoria).values(evento);
}

/** Quantas vezes o usuário fez a ação desde `desde` (usado como limite de frequência). */
export async function contarAcoesRecentes(
  db: BancoDeDados,
  atorId: string,
  acao: string,
  desde: Date,
): Promise<number> {
  const [linha] = await db
    .select({ total: count() })
    .from(auditoria)
    .where(
      and(eq(auditoria.atorId, atorId), eq(auditoria.acao, acao), gte(auditoria.createdAt, desde)),
    );
  return linha?.total ?? 0;
}
