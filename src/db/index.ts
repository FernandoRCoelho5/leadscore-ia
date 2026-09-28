import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { env } from "@/env";

import * as schema from "./schema";
import type { BancoDeDados } from "./tipos";

/**
 * Conexão com o Neon Postgres.
 *
 * Usa o Pool do driver serverless do Neon (WebSocket), que suporta transações
 * (D-019). A string de conexão deve ser a com pooling, na mesma região da
 * aplicação (São Paulo).
 *
 * Em desenvolvimento o Next.js recarrega os módulos a cada alteração; guardar o
 * pool no `globalThis` evita abrir um pool novo a cada recarga.
 */
const globalComPool = globalThis as typeof globalThis & { poolLeadScore?: Pool };

const pool = globalComPool.poolLeadScore ?? new Pool({ connectionString: env.DATABASE_URL });
if (env.NODE_ENV !== "production") {
  globalComPool.poolLeadScore = pool;
}

export const db: BancoDeDados = drizzle({ client: pool, schema });

/** Fecha as conexões. Usado por scripts (ex.: seed) ao terminar. */
export async function encerrarBanco(): Promise<void> {
  await pool.end();
  globalComPool.poolLeadScore = undefined;
}
