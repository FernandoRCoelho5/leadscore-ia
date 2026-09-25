import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { analises, leads, type Analise, type NovaAnalise } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";

import { ehUuid } from "./utilitarios";

/**
 * Acesso ao histórico de análises. Análises nunca são alteradas: cada
 * (re)análise é uma nova linha, e o lead guarda uma cópia da mais recente.
 */

export type DadosDaAnalise = Omit<
  NovaAnalise,
  "id" | "leadId" | "empresaId" | "createdAt" | "updatedAt" | "deletedAt"
>;

/** Número máximo de análises devolvidas no histórico de um lead. */
const LIMITE_DO_HISTORICO = 50;

/**
 * Grava uma análise e atualiza a cópia no lead, na mesma transação.
 * Devolve `undefined` se o lead não existir, estiver excluído ou for de outra empresa.
 */
export async function registrarAnalise(
  db: BancoDeDados,
  empresaId: string,
  leadId: string,
  dados: DadosDaAnalise,
): Promise<Analise | undefined> {
  if (!ehUuid(leadId)) {
    return undefined;
  }

  return db.transaction(async (tx) => {
    // Atualizar o lead primeiro confirma que ele pertence à empresa.
    const atualizados = await tx
      .update(leads)
      .set({
        scoreAtual: dados.score,
        classificacaoAtual: dados.classificacao,
        statusAnalise: "concluida",
      })
      .where(and(eq(leads.id, leadId), eq(leads.empresaId, empresaId), isNull(leads.deletedAt)))
      .returning({ id: leads.id });
    if (atualizados.length === 0) {
      return undefined;
    }

    const [analise] = await tx
      .insert(analises)
      .values({ ...dados, leadId, empresaId })
      .returning();
    return analise;
  });
}

/** Histórico de análises do lead, da mais recente para a mais antiga. */
export async function listarAnalisesDoLead(
  db: BancoDeDados,
  empresaId: string,
  leadId: string,
): Promise<Analise[]> {
  if (!ehUuid(leadId)) {
    return [];
  }
  return db
    .select()
    .from(analises)
    .where(
      and(
        eq(analises.leadId, leadId),
        eq(analises.empresaId, empresaId),
        isNull(analises.deletedAt),
      ),
    )
    .orderBy(desc(analises.createdAt), desc(analises.id))
    .limit(LIMITE_DO_HISTORICO);
}
