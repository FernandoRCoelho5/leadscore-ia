import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterEach, describe, expect, it } from "vitest";

import {
  objetosCriados,
  planejarLinhaDeBase,
  prepararMigrations,
  type Conexao,
} from "../../scripts/banco/prepararMigrations";

/**
 * Preparação do banco E2E (D-025) contra um Postgres de verdade (PGlite). A
 * "cópia schema only" do Neon é simulada rodando o SQL das migrations direto,
 * sem registrar nada na tabela de controle do Drizzle.
 */

const MIGRATIONS = readMigrationFiles({ migrationsFolder: "./drizzle" });

let bancos: PGlite[] = [];

afterEach(async () => {
  await Promise.all(bancos.map((banco) => banco.close()));
  bancos = [];
});

function novoBanco() {
  const banco = new PGlite({ extensions: { pg_trgm } });
  bancos.push(banco);
  const conexao: Conexao = {
    query: (texto, parametros) => banco.query<Record<string, unknown>>(texto, parametros),
  };
  return { banco, conexao };
}

/** Cria os objetos das migrations sem registrá-las (como a branch "schema only"). */
async function copiarSoOSchema(banco: PGlite, quantidade: number) {
  for (const migration of MIGRATIONS.slice(0, quantidade)) {
    for (const comando of migration.sql) {
      await banco.exec(comando);
    }
  }
}

async function registros(banco: PGlite) {
  const { rows } = await banco.query<{ hash: string; created_at: string | number | bigint }>(
    `SELECT hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at`,
  );
  return rows.map((linha) => ({ hash: linha.hash, criadaEm: Number(linha.created_at) }));
}

const esperados = (quantidade: number) =>
  MIGRATIONS.slice(0, quantidade).map((migration) => ({
    hash: migration.hash,
    criadaEm: migration.folderMillis,
  }));

describe("prepararMigrations", () => {
  it("banco vazio: aplica todas as migrations", async () => {
    const { banco, conexao } = novoBanco();

    const resumo = await prepararMigrations(conexao, MIGRATIONS);

    expect(resumo).toEqual({ registradas: 0, aplicadas: MIGRATIONS.length });
    expect(await registros(banco)).toEqual(esperados(MIGRATIONS.length));
  });

  it("cópia schema only completa: só registra, sem rodar nada de novo", async () => {
    const { banco, conexao } = novoBanco();
    await copiarSoOSchema(banco, MIGRATIONS.length);

    const resumo = await prepararMigrations(conexao, MIGRATIONS);

    expect(resumo).toEqual({ registradas: MIGRATIONS.length, aplicadas: 0 });
    // Mesmo hash e mesma data que o Drizzle gravaria: o drizzle-kit migrate segue funcionando.
    expect(await registros(banco)).toEqual(esperados(MIGRATIONS.length));
  });

  it("cópia de um schema mais antigo: registra o que existe e aplica o resto", async () => {
    const { banco, conexao } = novoBanco();
    await copiarSoOSchema(banco, MIGRATIONS.length - 1);

    const resumo = await prepararMigrations(conexao, MIGRATIONS);

    expect(resumo).toEqual({ registradas: MIGRATIONS.length - 1, aplicadas: 1 });
    expect(await registros(banco)).toEqual(esperados(MIGRATIONS.length));
  });

  it("rodar de novo não muda nada (idempotente)", async () => {
    const { banco, conexao } = novoBanco();
    await prepararMigrations(conexao, MIGRATIONS);

    const resumo = await prepararMigrations(conexao, MIGRATIONS);

    expect(resumo).toEqual({ registradas: 0, aplicadas: 0 });
    expect(await registros(banco)).toHaveLength(MIGRATIONS.length);
  });

  it("migration pela metade: para sem alterar nada", async () => {
    const { banco, conexao } = novoBanco();
    await copiarSoOSchema(banco, 1);
    // Só o primeiro comando da migration 0001: estado inconsistente.
    await banco.exec(MIGRATIONS[1]?.sql[0] ?? "");

    await expect(prepararMigrations(conexao, MIGRATIONS)).rejects.toThrow(
      /migration nº 1 está "parcial"/,
    );
    // A transação foi desfeita: nem a tabela de controle ficou criada.
    const { rows } = await banco.query<{ existe: boolean }>(
      `SELECT to_regclass('"drizzle"."__drizzle_migrations"') IS NOT NULL AS existe`,
    );
    expect(rows[0]?.existe).toBe(false);
  });
});

describe("planejarLinhaDeBase", () => {
  it.each([
    [["ausente", "ausente"], 0],
    [["aplicada", "aplicada", "ausente"], 2],
    // As migrations rodam em ordem: uma "indeterminada" antes de uma aplicada também rodou.
    [["aplicada", "indeterminada", "aplicada", "ausente"], 3],
  ] as const)("%j → registra %i", (estados, quantidade) => {
    expect(planejarLinhaDeBase(estados)).toBe(quantidade);
  });

  it.each([
    [["aplicada", "ausente", "aplicada"]],
    [["aplicada", "parcial"]],
    [["indeterminada", "ausente"]],
  ] as const)("%j → recusa (banco inconsistente ou sem como saber)", (estados) => {
    expect(() => planejarLinhaDeBase(estados)).toThrow("Confira o banco manualmente");
  });
});

describe("objetosCriados", () => {
  it("reconhece todos os comandos das migrations atuais", () => {
    for (const migration of MIGRATIONS) {
      expect(objetosCriados(migration.sql)).not.toBeNull();
    }
  });

  it("ignora comentários e reconhece cada tipo de objeto", () => {
    expect(
      objetosCriados([
        "-- comentário\nCREATE EXTENSION IF NOT EXISTS pg_trgm;",
        'CREATE TYPE "public"."status" AS ENUM(\'a\');',
        'CREATE TABLE "leads" (\n "id" uuid);',
        'CREATE UNIQUE INDEX "leads_unico" ON "leads" ("id");',
        'ALTER TABLE "leads" ADD CONSTRAINT "leads_fk" FOREIGN KEY ("id") REFERENCES "x"("id");',
        'ALTER TABLE "leads" ADD COLUMN "nota" integer;',
      ]),
    ).toEqual([
      { tipo: "extensao", nome: "pg_trgm" },
      { tipo: "tipo", esquema: "public", nome: "status" },
      { tipo: "relacao", nome: "leads" },
      { tipo: "relacao", nome: "leads_unico" },
      { tipo: "restricao", tabela: "leads", nome: "leads_fk" },
      { tipo: "coluna", tabela: "leads", nome: "nota" },
    ]);
  });

  it("comando que não cria objeto (ex.: UPDATE) torna a migration indeterminada", () => {
    expect(objetosCriados(['UPDATE "leads" SET "nota" = 0;'])).toBeNull();
  });
});
