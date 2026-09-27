import "server-only";

import { and, count, desc, eq, gte, lt, type SQL } from "drizzle-orm";

import { auditoria, empresas, usuarios, type EventoDeAuditoria } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import type { AcaoDaAuditoria } from "@/lib/auditoria";
import {
  deslocamento,
  esquemaPaginacao,
  montarPagina,
  TAMANHO_DO_LOTE_DE_EXPORTACAO,
  type Pagina,
  type Paginacao,
} from "@/lib/paginacao";

/**
 * Registro de ações sensíveis (anonimização, exportação, exclusão lógica,
 * alteração de perfil...). Só inserções: a auditoria nunca é alterada.
 * Regra: `detalhes` não pode conter dados pessoais (nome, e-mail, telefone).
 */

/** A ação precisa estar no catálogo (`src/lib/auditoria.ts`), com o texto da tela. */
export type NovoEventoDeAuditoria = Omit<
  EventoDeAuditoria,
  "id" | "acao" | "createdAt" | "updatedAt" | "deletedAt"
> & { acao: AcaoDaAuditoria };

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

export type FiltrosDaAuditoria = { acao?: AcaoDaAuditoria; desde?: Date; ate?: Date };

/** Linha lida do banco (o tipo `EventoDeAuditoria` é o da inserção, com campos opcionais). */
export type EventoNaLista = Pick<
  typeof auditoria.$inferSelect,
  "id" | "acao" | "recursoTipo" | "recursoId" | "detalhes" | "createdAt"
> & { atorNome: string | null; atorEmail: string | null; empresaNome: string | null };

function condicoesDosFiltros(filtros: FiltrosDaAuditoria): SQL[] {
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
  return condicoes;
}

/** Colunas da lista e do CSV: o evento, quem fez e em qual empresa. */
function consultaDeEventos(db: BancoDeDados) {
  return db
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
    .$dynamic();
}

/** Consulta da auditoria (equipe Brasa), do evento mais recente para o mais antigo. */
export async function listarAuditoria(
  db: BancoDeDados,
  filtros: FiltrosDaAuditoria,
  paginacao: Partial<Paginacao>,
): Promise<Pagina<EventoNaLista>> {
  const pagina = esquemaPaginacao.parse(paginacao);
  const condicoes = condicoesDosFiltros(filtros);
  const filtro = condicoes.length > 0 ? and(...condicoes) : undefined;

  const [itens, [linhaDoTotal]] = await Promise.all([
    consultaDeEventos(db)
      .where(filtro)
      .orderBy(desc(auditoria.createdAt), desc(auditoria.id))
      .limit(pagina.porPagina)
      .offset(deslocamento(pagina)),
    db.select({ total: count() }).from(auditoria).where(filtro),
  ]);
  return montarPagina(itens, linhaDoTotal?.total ?? 0, pagina);
}

/**
 * Eventos para o CSV, em lotes, do mais novo para o mais antigo. A auditoria
 * é a tabela que mais cresce (cada login é um evento): a leitura é por cursor
 * (id menor que o último lido; UUID v7 cresce com o tempo), e não por OFFSET,
 * então cada lote custa o mesmo, com mil ou um milhão de eventos.
 */
export async function* lotesDaAuditoriaParaExportar(
  db: BancoDeDados,
  filtros: FiltrosDaAuditoria,
  tamanhoDoLote: number = TAMANHO_DO_LOTE_DE_EXPORTACAO,
): AsyncGenerator<EventoNaLista[]> {
  const condicoes = condicoesDosFiltros(filtros);
  let ultimoId: string | undefined;
  for (;;) {
    const lote = await consultaDeEventos(db)
      .where(and(...condicoes, ultimoId ? lt(auditoria.id, ultimoId) : undefined))
      .orderBy(desc(auditoria.id))
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
