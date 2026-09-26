import "server-only";

import { and, count, desc, eq, gte, lt, type SQL } from "drizzle-orm";

import { auditoria, empresas, usuarios, type EventoDeAuditoria } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import {
  deslocamento,
  esquemaPaginacao,
  montarPagina,
  type Pagina,
  type Paginacao,
} from "@/lib/paginacao";

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

export type FiltrosDaAuditoria = { acao?: string; desde?: Date; ate?: Date };

export type EventoNaLista = Pick<
  EventoDeAuditoria,
  "id" | "acao" | "recursoTipo" | "recursoId" | "detalhes" | "createdAt"
> & { atorNome: string | null; atorEmail: string | null; empresaNome: string | null };

/** Consulta da auditoria (equipe Brasa), do evento mais recente para o mais antigo. */
export async function listarAuditoria(
  db: BancoDeDados,
  filtros: FiltrosDaAuditoria,
  paginacao: Partial<Paginacao>,
): Promise<Pagina<EventoNaLista>> {
  const pagina = esquemaPaginacao.parse(paginacao);
  const condicoes: SQL[] = [];
  if (filtros.acao) {
    condicoes.push(eq(auditoria.acao, filtros.acao));
  }
  if (filtros.desde) {
    condicoes.push(gte(auditoria.createdAt, filtros.desde));
  }
  if (filtros.ate) {
    condicoes.push(lt(auditoria.createdAt, filtros.ate));
  }
  const filtro = condicoes.length > 0 ? and(...condicoes) : undefined;

  const [itens, [linhaDoTotal]] = await Promise.all([
    db
      .select({
        id: auditoria.id,
        acao: auditoria.acao,
        recursoTipo: auditoria.recursoTipo,
        recursoId: auditoria.recursoId,
        detalhes: auditoria.detalhes,
        createdAt: auditoria.createdAt,
        atorNome: usuarios.nome,
        atorEmail: usuarios.email,
        empresaNome: empresas.nome,
      })
      .from(auditoria)
      .leftJoin(usuarios, eq(usuarios.id, auditoria.atorId))
      .leftJoin(empresas, eq(empresas.id, auditoria.empresaId))
      .where(filtro)
      .orderBy(desc(auditoria.createdAt), desc(auditoria.id))
      .limit(pagina.porPagina)
      .offset(deslocamento(pagina)),
    db.select({ total: count() }).from(auditoria).where(filtro),
  ]);
  return montarPagina(itens, linhaDoTotal?.total ?? 0, pagina);
}
