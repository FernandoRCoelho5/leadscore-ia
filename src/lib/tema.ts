/**
 * Tema da interface (identidade Brasa).
 *
 * - "claro": padrão do produto.
 * - "escuro": escolhido pelo usuário.
 * - "sistema": segue a preferência do sistema operacional.
 *
 * A escolha fica num cookie e é aplicada no servidor, como atributo
 * `data-tema` do <html>. Assim a página já chega com as cores certas: não há
 * "piscada" de tema nem script inline (que a CSP bloquearia).
 */
export const TEMAS = ["claro", "escuro", "sistema"] as const;

export type Tema = (typeof TEMAS)[number];

export const TEMA_PADRAO: Tema = "claro";

export const COOKIE_DO_TEMA = "tema";

/** Converte o valor do cookie (não confiável) num tema válido. */
export function lerTema(valor: string | undefined): Tema {
  return TEMAS.find((tema) => tema === valor) ?? TEMA_PADRAO;
}
