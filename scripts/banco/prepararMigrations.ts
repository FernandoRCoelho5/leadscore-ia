/**
 * Prepara um banco para receber as migrations do Drizzle, mesmo quando ele foi
 * criado como cópia "schema only" de outra branch do Neon (D-025).
 *
 * O problema: a cópia só de schema traz as tabelas, mas não as linhas de
 * `drizzle.__drizzle_migrations`. O migrator acha que nada foi aplicado, roda
 * a migration 0000 de novo e falha com "já existe".
 *
 * A solução (sem apagar nada): quando o controle está vazio mas os objetos já
 * existem, cada migration é conferida no catálogo do Postgres (tabelas,
 * índices, tipos, extensões, restrições e colunas que ela cria). As que já
 * estão aplicadas são só registradas ("linha de base"); as demais são
 * aplicadas. Tudo numa transação, com uma trava (advisory lock) para duas
 * execuções do CI ao mesmo tempo não aplicarem a mesma migration duas vezes.
 *
 * O registro segue o formato do próprio Drizzle (mesmo hash e mesma data),
 * então `drizzle-kit migrate` continua funcionando normalmente depois.
 */

/** Uma migration lida pelo `readMigrationFiles` do Drizzle. */
export type Migration = {
  sql: string[];
  folderMillis: number;
  hash: string;
};

/** O mínimo de uma conexão Postgres (Neon ou PGlite) de que este módulo precisa. */
export type Conexao = {
  query(texto: string, parametros?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

export type ObjetoDoBanco =
  | { tipo: "extensao"; nome: string }
  | { tipo: "tipo"; esquema: string; nome: string }
  | { tipo: "relacao"; nome: string }
  | { tipo: "restricao"; tabela: string; nome: string }
  | { tipo: "coluna"; tabela: string; nome: string };

export type EstadoDaMigration = "aplicada" | "ausente" | "parcial" | "indeterminada";

const RECONHECEDORES: [RegExp, (partes: string[]) => ObjetoDoBanco][] = [
  [/^CREATE EXTENSION IF NOT EXISTS "?(\w+)"?/i, ([nome = ""]) => ({ tipo: "extensao", nome })],
  [
    /^CREATE TYPE "(\w+)"\."(\w+)"/i,
    ([esquema = "", nome = ""]) => ({ tipo: "tipo", esquema, nome }),
  ],
  [/^CREATE TABLE (?:IF NOT EXISTS )?"(\w+)"/i, ([nome = ""]) => ({ tipo: "relacao", nome })],
  [
    /^CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?"(\w+)"/i,
    ([nome = ""]) => ({ tipo: "relacao", nome }),
  ],
  [
    /^ALTER TABLE "(\w+)" ADD CONSTRAINT "(\w+)"/i,
    ([tabela = "", nome = ""]) => ({ tipo: "restricao", tabela, nome }),
  ],
  [
    /^ALTER TABLE "(\w+)" ADD COLUMN "(\w+)"/i,
    ([tabela = "", nome = ""]) => ({ tipo: "coluna", tabela, nome }),
  ],
];

/**
 * Objetos que os comandos de uma migration criam. `null` quando algum comando
 * não é reconhecido (ex.: UPDATE, ALTER COLUMN): não dá para saber pelo
 * catálogo se ele já rodou.
 */
export function objetosCriados(comandos: readonly string[]): ObjetoDoBanco[] | null {
  const objetos: ObjetoDoBanco[] = [];
  for (const comando of comandos) {
    const semComentarios = comando.replace(/--.*$/gm, "").trim();
    if (semComentarios === "") {
      continue;
    }
    const reconhecido = RECONHECEDORES.find(([padrao]) => padrao.test(semComentarios));
    if (!reconhecido) {
      return null;
    }
    const [padrao, criar] = reconhecido;
    objetos.push(criar(padrao.exec(semComentarios)?.slice(1) ?? []));
  }
  return objetos;
}

const CONSULTA_DE_EXISTENCIA: Record<ObjetoDoBanco["tipo"], string> = {
  extensao: "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = $1) AS existe",
  tipo: `SELECT EXISTS (
           SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = $1 AND t.typname = $2) AS existe`,
  relacao: "SELECT to_regclass(quote_ident($1)) IS NOT NULL AS existe",
  restricao: `SELECT EXISTS (
                SELECT 1 FROM pg_constraint
                 WHERE conrelid = to_regclass(quote_ident($1)) AND conname = $2) AS existe`,
  coluna: `SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2
           ) AS existe`,
};

function parametrosDe(objeto: ObjetoDoBanco): string[] {
  switch (objeto.tipo) {
    case "extensao":
    case "relacao":
      return [objeto.nome];
    case "tipo":
      return [objeto.esquema, objeto.nome];
    case "restricao":
    case "coluna":
      return [objeto.tabela, objeto.nome];
  }
}

async function existe(conexao: Conexao, objeto: ObjetoDoBanco): Promise<boolean> {
  const { rows } = await conexao.query(CONSULTA_DE_EXISTENCIA[objeto.tipo], parametrosDe(objeto));
  return rows[0]?.existe === true;
}

export async function estadoDaMigration(
  conexao: Conexao,
  migration: Migration,
): Promise<EstadoDaMigration> {
  const objetos = objetosCriados(migration.sql);
  if (objetos === null) {
    return "indeterminada";
  }
  let encontrados = 0;
  for (const objeto of objetos) {
    if (await existe(conexao, objeto)) {
      encontrados += 1;
    }
  }
  if (encontrados === objetos.length) {
    return "aplicada";
  }
  return encontrados === 0 ? "ausente" : "parcial";
}

/**
 * Quantas migrations, do início, já estão no banco. As migrations rodam em
 * ordem: se uma posterior está aplicada, as anteriores também estão (mesmo as
 * "indeterminadas"). Depois da última aplicada, todas precisam estar ausentes.
 * Qualquer outro quadro é um banco inconsistente, e a preparação para.
 */
export function planejarLinhaDeBase(estados: readonly EstadoDaMigration[]): number {
  const quantidade = estados.lastIndexOf("aplicada") + 1;
  const problemaAntes = estados
    .slice(0, quantidade)
    .findIndex((estado) => estado === "ausente" || estado === "parcial");
  const problemaDepois = estados.slice(quantidade).findIndex((estado) => estado !== "ausente");

  if (problemaAntes >= 0 || problemaDepois >= 0) {
    const indice = problemaAntes >= 0 ? problemaAntes : quantidade + problemaDepois;
    throw new Error(
      `A migration nº ${indice} está "${estados[indice]}" num banco sem registro de migrations. ` +
        "Confira o banco manualmente antes de continuar (nada foi alterado).",
    );
  }
  return quantidade;
}

const TABELA_DE_CONTROLE = `"drizzle"."__drizzle_migrations"`;
// Chave fixa da trava: qualquer número serve, desde que seja sempre o mesmo.
const CHAVE_DA_TRAVA = 20_260_926;

export type ResumoDaPreparacao = { registradas: number; aplicadas: number };

export async function prepararMigrations(
  conexao: Conexao,
  migrations: readonly Migration[],
): Promise<ResumoDaPreparacao> {
  await conexao.query("BEGIN");
  try {
    // Só uma preparação por vez neste banco; a trava se solta no fim da transação.
    await conexao.query("SELECT pg_advisory_xact_lock($1)", [CHAVE_DA_TRAVA]);
    // Mesma estrutura que o migrator do Drizzle cria.
    await conexao.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await conexao.query(
      `CREATE TABLE IF NOT EXISTS ${TABELA_DE_CONTROLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
    );

    const { rows } = await conexao.query(
      `SELECT count(*)::int AS total, max(created_at)::bigint AS ultima FROM ${TABELA_DE_CONTROLE}`,
    );
    let registradas = 0;
    let ultima = Number(rows[0]?.ultima ?? 0);

    if (Number(rows[0]?.total ?? 0) === 0) {
      const estados: EstadoDaMigration[] = [];
      for (const migration of migrations) {
        estados.push(await estadoDaMigration(conexao, migration));
      }
      registradas = planejarLinhaDeBase(estados);
      for (const migration of migrations.slice(0, registradas)) {
        await registrar(conexao, migration);
        ultima = migration.folderMillis;
      }
    }

    // Igual ao migrator do Drizzle: aplica as migrations mais novas que a última registrada.
    let aplicadas = 0;
    for (const migration of migrations) {
      if (migration.folderMillis > ultima) {
        for (const comando of migration.sql) {
          await conexao.query(comando);
        }
        await registrar(conexao, migration);
        aplicadas += 1;
      }
    }

    await conexao.query("COMMIT");
    return { registradas, aplicadas };
  } catch (erro) {
    await conexao.query("ROLLBACK");
    throw erro;
  }
}

async function registrar(conexao: Conexao, migration: Migration): Promise<void> {
  await conexao.query(`INSERT INTO ${TABELA_DE_CONTROLE} (hash, created_at) VALUES ($1, $2)`, [
    migration.hash,
    migration.folderMillis,
  ]);
}
