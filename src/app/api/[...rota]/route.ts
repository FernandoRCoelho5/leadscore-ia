import { ErroNaoEncontrado } from "@/lib/erros";
import { comTratamentoDeErros } from "@/server/http/responder";

/**
 * Qualquer caminho em /api que não corresponda a uma rota existente cai aqui e
 * recebe o 404 no formato único de erro, em vez da página HTML padrão.
 * Rotas específicas sempre têm prioridade sobre esta rota coringa.
 */
const rotaInexistente = comTratamentoDeErros(async () => {
  throw new ErroNaoEncontrado("Rota de API não encontrada.");
});

export const GET = rotaInexistente;
export const POST = rotaInexistente;
export const PUT = rotaInexistente;
export const PATCH = rotaInexistente;
export const DELETE = rotaInexistente;
