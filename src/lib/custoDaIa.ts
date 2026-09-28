/**
 * Preço do Claude Haiku 4.5 por milhão de tokens, em dólares (consultado em
 * 26/09/2026, D-027). Uma fonte só para a avaliação e a visão geral.
 */
export const PRECO_ENTRADA_POR_MILHAO = 1;
export const PRECO_SAIDA_POR_MILHAO = 5;

export function custoEstimadoEmDolares(tokensEntrada: number, tokensSaida: number): number {
  return (
    (tokensEntrada * PRECO_ENTRADA_POR_MILHAO + tokensSaida * PRECO_SAIDA_POR_MILHAO) / 1_000_000
  );
}

const DOLARES = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatarDolares(valor: number): string {
  return DOLARES.format(valor);
}
