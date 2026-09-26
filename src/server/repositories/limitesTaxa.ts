import "server-only";

import { sql } from "drizzle-orm";

import { limitesTaxa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";

/**
 * Contadores do rate limiting do formulário público (D-009 e D-028), em janela
 * fixa: cada chave tem o início da janela atual e quantas tentativas houve
 * nela. A linha de cada chave é reaproveitada; nada é apagado.
 */

export type ContagemNaJanela = {
  /** Tentativas na janela atual, já contando esta. */
  contador: number;
  janelaInicio: Date;
};

/**
 * Registra uma tentativa e devolve a contagem da janela, numa única instrução
 * atômica (INSERT ... ON CONFLICT DO UPDATE): pedidos simultâneos nunca se
 * perdem nem contam duas vezes. Se a janela anterior já terminou, a contagem
 * recomeça em 1 com uma janela nova.
 *
 * No SET, as colunas referem-se à linha antiga, e o Postgres avalia todas as
 * expressões com os valores de antes da atualização.
 */
export async function registrarTentativa(
  db: BancoDeDados,
  chave: string,
  janelaMs: number,
  agora: Date = new Date(),
): Promise<ContagemNaJanela> {
  const agoraSql = sql`${agora.toISOString()}::timestamptz`;
  const janelaVencida = sql`${limitesTaxa.janelaInicio} <= ${new Date(agora.getTime() - janelaMs).toISOString()}::timestamptz`;

  const [linha] = await db
    .insert(limitesTaxa)
    .values({ chave, janelaInicio: agora, contador: 1 })
    .onConflictDoUpdate({
      target: limitesTaxa.chave,
      set: {
        contador: sql`CASE WHEN ${janelaVencida} THEN 1 ELSE ${limitesTaxa.contador} + 1 END`,
        janelaInicio: sql`CASE WHEN ${janelaVencida} THEN ${agoraSql} ELSE ${limitesTaxa.janelaInicio} END`,
        updatedAt: agora,
      },
    })
    .returning({ contador: limitesTaxa.contador, janelaInicio: limitesTaxa.janelaInicio });

  if (!linha) {
    throw new Error("O banco não devolveu a contagem do limite de taxa.");
  }
  return linha;
}
