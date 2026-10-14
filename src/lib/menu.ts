/**
 * Menu lateral recolhido ou aberto (só no computador). A escolha fica num
 * cookie, como o tema, e o servidor já desenha o menu do jeito certo: não há
 * "pulo" de largura ao carregar. O valor do cookie não é confiável: qualquer
 * coisa diferente de "recolhido" vale como aberto.
 */
export const COOKIE_DO_MENU = "menu";

export const VALOR_RECOLHIDO = "recolhido";

export function lerMenuRecolhido(valor: string | undefined): boolean {
  return valor === VALOR_RECOLHIDO;
}
