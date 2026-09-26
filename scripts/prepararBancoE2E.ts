import "./carregarEnv";

import { Pool } from "@neondatabase/serverless";
import { readMigrationFiles } from "drizzle-orm/migrator";

import { prepararMigrations } from "./banco/prepararMigrations";

/**
 * Prepara o banco dos testes E2E (branch "e2e" do Neon, criada como "schema
 * only" a partir de production): registra as migrations que já existem nele e
 * aplica as novas. Não apaga nada. Detalhes em scripts/banco/prepararMigrations.ts
 * e em docs/decisoes.md (D-025).
 *
 * Uso: E2E_COM_BANCO=1 npm run db:preparar-e2e
 */
async function principal(): Promise<void> {
  if (process.env.E2E_COM_BANCO !== "1") {
    throw new Error("Defina E2E_COM_BANCO=1: este script é só para o banco dos testes E2E.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ausente.");
  }

  const pool = new Pool({ connectionString: url });
  const cliente = await pool.connect();
  try {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
    const resumo = await prepararMigrations(
      { query: (texto, parametros) => cliente.query(texto, parametros) },
      migrations,
    );
    console.log(
      `Banco E2E pronto: ${resumo.registradas} migration(s) já existente(s) registrada(s), ` +
        `${resumo.aplicadas} aplicada(s), ${migrations.length} no total.`,
    );
  } finally {
    cliente.release();
    await pool.end();
  }
}

principal().catch((erro: unknown) => {
  // Só a mensagem: a URL de conexão (com senha) nunca vai para o log.
  console.error("Falha ao preparar o banco E2E:", erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
