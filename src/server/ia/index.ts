import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { env } from "@/env";

import { criarClienteAnthropic, criarMotorClaude } from "./claude";
import { motorSimulado } from "./mock";
import type { MotorDeAnalise } from "./motor";

let cliente: Anthropic | undefined;

/**
 * Motor configurado pelo IA_MODO: "real" usa a Claude API; "mock" (padrão)
 * usa regras simuladas, sem custo. O cliente da API é criado uma única vez.
 */
export function obterMotor(): MotorDeAnalise {
  if (env.IA_MODO !== "real") {
    return motorSimulado;
  }
  if (!env.ANTHROPIC_API_KEY) {
    // O src/env.ts já exige a chave com IA_MODO=real; esta checagem é só para o tipo.
    throw new Error("ANTHROPIC_API_KEY ausente com IA_MODO=real.");
  }
  cliente ??= criarClienteAnthropic(env.ANTHROPIC_API_KEY);
  return criarMotorClaude(cliente);
}
