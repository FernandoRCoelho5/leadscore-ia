import { z } from "zod";

/**
 * Paginação no servidor (D-014). Nenhuma listagem devolve mais que
 * TAMANHO_MAXIMO_PAGINA itens por vez, mesmo que a URL peça mais.
 */
export const TAMANHO_MAXIMO_PAGINA = 100;
export const TAMANHO_PADRAO_PAGINA = 20;

export const esquemaPaginacao = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce
    .number()
    .int()
    .min(1)
    .max(TAMANHO_MAXIMO_PAGINA)
    .default(TAMANHO_PADRAO_PAGINA),
});

export type Paginacao = z.infer<typeof esquemaPaginacao>;

export type Pagina<T> = {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
};

/** Quantos registros pular para chegar à página pedida. */
export function deslocamento({ pagina, porPagina }: Paginacao): number {
  return (pagina - 1) * porPagina;
}

export function montarPagina<T>(itens: T[], total: number, paginacao: Paginacao): Pagina<T> {
  return {
    itens,
    total,
    pagina: paginacao.pagina,
    porPagina: paginacao.porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / paginacao.porPagina)),
  };
}
