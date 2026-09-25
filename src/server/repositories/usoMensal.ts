import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { usoMensal, type UsoMensal } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";

/**
 * Consumo de análises por empresa e mês (D-008): base do limite mensal e,
 * no futuro, da cobrança.
 */

const FORMATO_ANO_MES = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

/** Competência (primeiro dia do mês, no fuso de São Paulo) no formato AAAA-MM-01. */
export function competenciaDe(data: Date): string {
  return `${FORMATO_ANO_MES.format(data)}-01`;
}

/**
 * Tenta consumir uma análise do limite mensal. Devolve `false` se o limite
 * já foi atingido.
 *
 * É atômico: o INSERT ... ON CONFLICT DO UPDATE ... WHERE incrementa o
 * contador só se ainda houver saldo, numa única instrução. Duas análises
 * simultâneas nunca ultrapassam o limite (sem condição de corrida).
 */
export async function consumirAnalise(
  db: BancoDeDados,
  empresaId: string,
  limite: number,
  competencia: string = competenciaDe(new Date()),
): Promise<boolean> {
  if (limite < 1) {
    return false;
  }
  const consumidos = await db
    .insert(usoMensal)
    .values({ empresaId, competencia, analises: 1 })
    .onConflictDoUpdate({
      target: [usoMensal.empresaId, usoMensal.competencia],
      set: { analises: sql`${usoMensal.analises} + 1`, updatedAt: new Date() },
      setWhere: sql`${usoMensal.analises} < ${limite}`,
    })
    .returning({ analises: usoMensal.analises });
  return consumidos.length > 0;
}

/** Soma os tokens gastos por uma análise ao consumo do mês (controle de custo). */
export async function registrarTokens(
  db: BancoDeDados,
  empresaId: string,
  tokens: { entrada: number; saida: number },
  competencia: string = competenciaDe(new Date()),
): Promise<void> {
  await db
    .insert(usoMensal)
    .values({
      empresaId,
      competencia,
      tokensEntrada: tokens.entrada,
      tokensSaida: tokens.saida,
    })
    .onConflictDoUpdate({
      target: [usoMensal.empresaId, usoMensal.competencia],
      set: {
        tokensEntrada: sql`${usoMensal.tokensEntrada} + ${tokens.entrada}`,
        tokensSaida: sql`${usoMensal.tokensSaida} + ${tokens.saida}`,
        updatedAt: new Date(),
      },
    });
}

export async function obterUsoDoMes(
  db: BancoDeDados,
  empresaId: string,
  competencia: string = competenciaDe(new Date()),
): Promise<UsoMensal | undefined> {
  const [uso] = await db
    .select()
    .from(usoMensal)
    .where(and(eq(usoMensal.empresaId, empresaId), eq(usoMensal.competencia, competencia)))
    .limit(1);
  return uso;
}
