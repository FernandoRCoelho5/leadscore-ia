import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { ErroApp, ErroLimiteExcedido, type CodigoErro, type DetalheDeCampo } from "@/lib/erros";
import { logger } from "@/lib/logger";

/**
 * Formato único de erro de todas as rotas de API:
 *
 *   { "erro": { "codigo": "NAO_ENCONTRADO", "mensagem": "...", "requestId": "..." } }
 *
 * O `requestId` liga a resposta ao log do servidor, onde ficam os detalhes
 * técnicos. Erros inesperados nunca expõem mensagem, pilha ou SQL ao cliente.
 */
export type CorpoDeErro = {
  erro: {
    codigo: CodigoErro;
    mensagem: string;
    detalhes?: readonly DetalheDeCampo[];
    requestId: string;
  };
};

export const MENSAGEM_ERRO_INTERNO = "Ocorreu um erro inesperado. Tente novamente mais tarde.";

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reaproveita um `x-request-id` válido recebido ou gera um novo. */
export function obterRequestId(cabecalhos: Headers): string {
  const recebido = cabecalhos.get("x-request-id");
  return recebido !== null && FORMATO_UUID.test(recebido) ? recebido : crypto.randomUUID();
}

type ErroTraduzido = {
  status: number;
  corpo: CorpoDeErro;
  tentarNovamenteEmSegundos?: number;
};

/** Converte qualquer erro no formato público e registra no log. */
export function traduzirErro(erro: unknown, requestId: string): ErroTraduzido {
  if (erro instanceof ErroApp) {
    // Erros 4xx são esperados: basta o código. A pilha só interessa nos 5xx.
    const contexto = { requestId, codigo: erro.codigo };
    if (erro.status >= 500) {
      logger.error(erro.message, { ...contexto, erro });
    } else if (["NAO_AUTENTICADO", "PROIBIDO", "LIMITE_EXCEDIDO"].includes(erro.codigo)) {
      // Falhas de acesso e excesso de tentativas interessam ao monitoramento de segurança.
      logger.warn(erro.message, contexto);
    } else {
      logger.info(erro.message, contexto);
    }

    return {
      status: erro.status,
      corpo: {
        erro: {
          codigo: erro.codigo,
          mensagem: erro.message,
          ...(erro.detalhes !== undefined && { detalhes: erro.detalhes }),
          requestId,
        },
      },
      ...(erro instanceof ErroLimiteExcedido &&
        erro.tentarNovamenteEmSegundos !== undefined && {
          tentarNovamenteEmSegundos: erro.tentarNovamenteEmSegundos,
        }),
    };
  }

  logger.error("Erro inesperado", { requestId, erro });
  return {
    status: 500,
    corpo: { erro: { codigo: "INTERNO", mensagem: MENSAGEM_ERRO_INTERNO, requestId } },
  };
}

export function respostaDeErro(erro: unknown, requestId: string): NextResponse<CorpoDeErro> {
  const { status, corpo, tentarNovamenteEmSegundos } = traduzirErro(erro, requestId);
  const cabecalhos = new Headers({ "x-request-id": requestId });
  if (tentarNovamenteEmSegundos !== undefined) {
    cabecalhos.set("Retry-After", String(tentarNovamenteEmSegundos));
  }
  return NextResponse.json(corpo, { status, headers: cabecalhos });
}

type HandlerDeRota<Contexto> = (
  request: NextRequest,
  contexto: Contexto,
  requestId: string,
) => Promise<Response>;

/**
 * Envolve um Route Handler: gera o requestId, captura qualquer erro e responde
 * no formato único. Assim nenhuma rota precisa de try/catch próprio.
 */
export function comTratamentoDeErros<Contexto>(handler: HandlerDeRota<Contexto>) {
  return async (request: NextRequest, contexto: Contexto): Promise<Response> => {
    const requestId = obterRequestId(request.headers);
    try {
      const resposta = await handler(request, contexto, requestId);
      try {
        resposta.headers.set("x-request-id", requestId);
      } catch {
        // Algumas respostas (ex.: Response.redirect) têm cabeçalhos imutáveis.
      }
      return resposta;
    } catch (erro) {
      return respostaDeErro(erro, requestId);
    }
  };
}
