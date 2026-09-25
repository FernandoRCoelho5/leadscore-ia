import "./carregarEnv";

import { Pool } from "@neondatabase/serverless";

import { env } from "../src/env";

/**
 * Inspeção SOMENTE LEITURA do banco configurado no .env.local.
 * Rode antes de aplicar migrations para confirmar em qual banco você está e o
 * que já existe nele. Não exibe credenciais.
 *
 * Uso: npm run db:verificar
 */
async function principal(): Promise<void> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    const { rows: info } = await pool.query<{ banco: string; versao: string }>(
      "SELECT current_database() AS banco, current_setting('server_version') AS versao",
    );
    console.log(`Banco: ${info[0]?.banco} (Postgres ${info[0]?.versao})`);

    const { rows: tabelas } = await pool.query<{ tabela: string }>(
      `SELECT table_schema || '.' || table_name AS tabela
         FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY 1`,
    );
    console.log(
      tabelas.length === 0
        ? "Tabelas: nenhuma (banco vazio)"
        : `Tabelas (${tabelas.length}): ${tabelas.map((t) => t.tabela).join(", ")}`,
    );

    const { rows: controle } = await pool.query<{ existe: boolean }>(
      "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS existe",
    );
    if (controle[0]?.existe) {
      const { rows } = await pool.query<{ aplicadas: number }>(
        "SELECT count(*)::int AS aplicadas FROM drizzle.__drizzle_migrations",
      );
      console.log(`Migrations aplicadas: ${rows[0]?.aplicadas ?? 0}`);
    } else {
      console.log("Migrations aplicadas: nenhuma");
    }
  } finally {
    await pool.end();
  }
}

principal().catch((erro: unknown) => {
  console.error("Falha ao inspecionar o banco:", erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
