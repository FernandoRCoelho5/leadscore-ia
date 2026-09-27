import { Pool } from "@neondatabase/serverless";
import { readMigrationFiles } from "drizzle-orm/migrator";

import { prepararMigrations, type ResumoDaPreparacao } from "./prepararMigrations";

export type ResumoDasMigrations = ResumoDaPreparacao & { total: number };

/**
 * Conecta no banco, registra as migrations que já existem nele (linha de base
 * das cópias "schema only") e aplica as novas da pasta drizzle/, numa
 * transação com trava (D-025). Usado pelo banco E2E e pelo deploy (D-031).
 */
export async function aplicarMigrations(url: string): Promise<ResumoDasMigrations> {
  const pool = new Pool({ connectionString: url });
  const cliente = await pool.connect();
  try {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const resumo = await prepararMigrations(
      { query: (texto, parametros) => cliente.query(texto, parametros) },
      migrations,
    );
    return { ...resumo, total: migrations.length };
  } finally {
    cliente.release();
    await pool.end();
  }
}
