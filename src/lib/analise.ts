import type { Lead, StatusAnalise } from "@/db/schema";

/**
 * Em que pé está a análise de um lead, do ponto de vista de quem olha a tela.
 *
 * A análise roda logo depois que o lead chega (D-007) e leva segundos; a
 * função tem no máximo 120 s. Um lead ainda "pendente" ou "processando" muito
 * depois disso não vai mudar sozinho: a análise não começou (ex.: o servidor
 * caiu antes) ou foi interrompida. Dizer "vai começar em instantes" nesse
 * caso engana; a tela passa a pedir uma nova análise.
 */
export type SituacaoDaAnalise = StatusAnalise | "nao_iniciada" | "interrompida";

/** Bem acima dos 120 s da função, para não acusar uma análise que ainda está rodando. */
export const MINUTOS_ATE_CONSIDERAR_PARADA = 10;

export function situacaoDaAnalise(
  lead: Pick<Lead, "statusAnalise" | "createdAt" | "updatedAt">,
  agora: Date = new Date(),
): SituacaoDaAnalise {
  const limite = agora.getTime() - MINUTOS_ATE_CONSIDERAR_PARADA * 60_000;
  if (lead.statusAnalise === "pendente" && lead.createdAt.getTime() < limite) {
    return "nao_iniciada";
  }
  // "processando" grava o updatedAt (repositories/leads.ts): conta a partir daí,
  // e não da chegada, porque uma reanálise de um lead antigo é legítima.
  if (lead.statusAnalise === "processando" && lead.updatedAt.getTime() < limite) {
    return "interrompida";
  }
  return lead.statusAnalise;
}
