import "server-only";

import { and, count, eq, gte, isNull, sql } from "drizzle-orm";

import { empresas, leads, usoMensal, usuarios } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";

/** Números da plataforma inteira, para a visão geral da equipe Brasa. */

export type ResumoDaPlataforma = {
  empresasAtivas: number;
  empresasBloqueadas: number;
  usuarios: number;
  usuariosBloqueados: number;
  leadsNoMes: number;
  analisesNoMes: number;
  tokensEntradaNoMes: number;
  tokensSaidaNoMes: number;
};

const contarSe = (condicao: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${condicao})`.mapWith(Number);

export async function resumirPlataforma(
  db: BancoDeDados,
  inicioDoMes: Date,
  competencia: string,
): Promise<ResumoDaPlataforma> {
  const [[situacoes], [contas], [leadsDoMes], [uso]] = await Promise.all([
    db
      .select({
        ativas: contarSe(sql`${empresas.status} = 'ativa'`),
        bloqueadas: contarSe(sql`${empresas.status} = 'bloqueada'`),
      })
      .from(empresas)
      .where(isNull(empresas.deletedAt)),
    db
      .select({ total: count(), bloqueados: contarSe(sql`${usuarios.bloqueadoEm} is not null`) })
      .from(usuarios)
      .where(isNull(usuarios.deletedAt)),
    db
      .select({ total: count() })
      .from(leads)
      .where(and(isNull(leads.deletedAt), gte(leads.createdAt, inicioDoMes))),
    db
      .select({
        analises: sql<number>`coalesce(sum(${usoMensal.analises}), 0)`.mapWith(Number),
        entrada: sql<number>`coalesce(sum(${usoMensal.tokensEntrada}), 0)`.mapWith(Number),
        saida: sql<number>`coalesce(sum(${usoMensal.tokensSaida}), 0)`.mapWith(Number),
      })
      .from(usoMensal)
      .where(eq(usoMensal.competencia, competencia)),
  ]);

  return {
    empresasAtivas: situacoes?.ativas ?? 0,
    empresasBloqueadas: situacoes?.bloqueadas ?? 0,
    usuarios: contas?.total ?? 0,
    usuariosBloqueados: contas?.bloqueados ?? 0,
    leadsNoMes: leadsDoMes?.total ?? 0,
    analisesNoMes: uso?.analises ?? 0,
    tokensEntradaNoMes: uso?.entrada ?? 0,
    tokensSaidaNoMes: uso?.saida ?? 0,
  };
}
