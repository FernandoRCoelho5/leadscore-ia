import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

/**
 * Tipo comum a qualquer conexão Drizzle com o nosso schema: o Neon em produção,
 * o PGlite nos testes e as transações (`tx`) de ambos. Os repositórios recebem
 * a conexão por parâmetro, o que permite testá-los com um banco descartável.
 */
export type BancoDeDados = PgDatabase<PgQueryResultHKT, typeof schema>;
