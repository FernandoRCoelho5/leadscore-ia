import "server-only";

import type { BancoDeDados } from "@/db/tipos";
import { registrarTentativa } from "@/server/repositories/limitesTaxa";

/**
 * Rate limiting (D-009). Quem usa conhece só esta interface: hoje os
 * contadores ficam no Postgres; trocar por Redis não muda os serviços.
 */

export type RegraDeLimite = {
  /** O que está sendo contado (ex.: um IP num formulário). Nunca um dado pessoal puro. */
  chave: string;
  limite: number;
  janelaMs: number;
};

export type ResultadoDoLimite =
  { permitido: true } | { permitido: false; tentarNovamenteEmSegundos: number };

export type LimitadorDeTaxa = {
  /** Conta uma tentativa e diz se ela cabe no limite. */
  consumir(regra: RegraDeLimite, agora?: Date): Promise<ResultadoDoLimite>;
};

export function limitadorNoBanco(db: BancoDeDados): LimitadorDeTaxa {
  return {
    async consumir({ chave, limite, janelaMs }, agora = new Date()) {
      const { contador, janelaInicio } = await registrarTentativa(db, chave, janelaMs, agora);
      if (contador <= limite) {
        return { permitido: true };
      }
      const fimDaJanela = janelaInicio.getTime() + janelaMs;
      return {
        permitido: false,
        tentarNovamenteEmSegundos: Math.max(1, Math.ceil((fimDaJanela - agora.getTime()) / 1000)),
      };
    },
  };
}
