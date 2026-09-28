import "server-only";

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
