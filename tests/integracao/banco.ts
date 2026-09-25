import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { criarEmpresa } from "@/server/repositories/empresas";

/**
 * Banco de testes: Postgres de verdade (PGlite, compilado para WebAssembly),
 * em memória e descartado ao final. Aplica as mesmas migrations que vão para
 * o Neon, então os testes também validam o SQL gerado. Nenhum banco real é
 * tocado e nada precisa ser apagado.
 */
export async function criarBancoDeTeste(): Promise<{
  db: BancoDeDados;
  encerrar: () => Promise<void>;
}> {
  const cliente = new PGlite({ extensions: { pg_trgm } });
  const db = drizzle({ client: cliente, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db, encerrar: () => cliente.close() };
}

let contador = 0;

/** Cria uma empresa com slug único para isolar os dados de cada teste. */
export async function criarEmpresaDeTeste(db: BancoDeDados, limiteAnalisesMes = 100) {
  contador += 1;
  return criarEmpresa(db, {
    nome: `Empresa de teste ${contador}`,
    slug: `teste-${contador}-${Date.now()}`,
    limiteAnalisesMes,
  });
}
