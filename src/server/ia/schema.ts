import "server-only";

import { z } from "zod";

import type { Classificacao } from "@/db/schema";

/**
 * Formato da resposta da IA (D-027). O mesmo schema restringe a saída na API
 * (structured outputs) e valida o JSON antes de salvar.
 *
 * A classificação não vem da IA: é derivada da nota por uma regra fixa do app
 * (`classificacaoDaNota`). Assim a etiqueta nunca contradiz a nota, e os
 * filtros do painel são previsíveis.
 */
export const esquemaDaRespostaDaIA = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Nota de 0 a 100: a chance de o lead virar cliente deste negócio."),
  justificativa: z
    .string()
    .min(1)
    .max(700)
    .describe("De 2 a 4 frases, em português, citando os fatos do lead que levaram à nota."),
  respostaSugerida: z
    .string()
    .min(1)
    .max(1500)
    .describe("Primeira resposta ao lead, em português, pronta para enviar por e-mail."),
});

export type RespostaDaIA = z.infer<typeof esquemaDaRespostaDaIA>;

/** Faixas da classificação (também descritas no prompt). */
export const FAIXAS = { quente: 70, morno: 40 } as const;

export function classificacaoDaNota(score: number): Classificacao {
  if (score >= FAIXAS.quente) {
    return "quente";
  }
  return score >= FAIXAS.morno ? "morno" : "frio";
}
