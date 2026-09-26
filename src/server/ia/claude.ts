import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { ErroDaIA, type MotorDeAnalise, type TokensUsados } from "./motor";
import { PROMPT_DE_SISTEMA, montarMensagem } from "./prompt";
import { esquemaDaRespostaDaIA, type RespostaDaIA } from "./schema";

/** Modelo definido no CLAUDE.md: rápido e barato para classificação. */
export const MODELO = "claude-haiku-4-5-20251001";

/** Justificativa + resposta sugerida cabem com folga (cerca de 350 tokens em média). */
const MAX_TOKENS = 1024;
/** Uma nova tentativa quando o JSON vem fora do schema. */
const TENTATIVAS_DE_FORMATO = 2;

/**
 * Cliente da Claude API. O SDK já repete sozinho os erros temporários (429,
 * 5xx e rede) com espera crescente; o timeout vale para cada tentativa.
 */
export function criarClienteAnthropic(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, timeout: 30_000, maxRetries: 2 });
}

function lerJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

/**
 * Motor real. Usa `messages.create` (e não `parse`) com saída estruturada para
 * conferir o `stop_reason` e contar os tokens antes de validar o JSON com o
 * nosso schema Zod: o que não passa na validação nunca é salvo.
 */
export function criarMotorClaude(cliente: Anthropic): MotorDeAnalise {
  return {
    async analisar(entrada) {
      const tokens: TokensUsados = { entrada: 0, saida: 0 };

      for (let tentativa = 1; tentativa <= TENTATIVAS_DE_FORMATO; tentativa += 1) {
        let mensagem: Anthropic.Message;
        try {
          mensagem = await cliente.messages.create({
            model: MODELO,
            max_tokens: MAX_TOKENS,
            // Mesma entrada, mesma nota: consistência importa mais que criatividade.
            temperature: 0,
            system: PROMPT_DE_SISTEMA,
            messages: [{ role: "user", content: montarMensagem(entrada) }],
            output_config: { format: zodOutputFormat(esquemaDaRespostaDaIA) },
          });
        } catch (erro) {
          // Conexão e timeout são subclasses de APIError no SDK: conferir antes.
          if (erro instanceof Anthropic.APIConnectionError) {
            throw new ErroDaIA("indisponivel", "Sem conexão com a Claude API.", {
              tokens,
              causa: erro,
            });
          }
          if (
            erro instanceof Anthropic.RateLimitError ||
            erro instanceof Anthropic.InternalServerError
          ) {
            throw new ErroDaIA("indisponivel", `Claude API indisponível (HTTP ${erro.status}).`, {
              tokens,
              causa: erro,
            });
          }
          if (erro instanceof Anthropic.APIError) {
            throw new ErroDaIA(
              "requisicao_recusada",
              `Claude API recusou a requisição (HTTP ${erro.status}).`,
              {
                tokens,
                causa: erro,
              },
            );
          }
          throw erro;
        }

        tokens.entrada += mensagem.usage.input_tokens;
        tokens.saida += mensagem.usage.output_tokens;

        if (mensagem.stop_reason === "refusal") {
          throw new ErroDaIA("recusa", "A IA recusou analisar o lead.", { tokens });
        }
        if (mensagem.stop_reason === "max_tokens") {
          throw new ErroDaIA("resposta_cortada", "A resposta da IA foi cortada.", { tokens });
        }

        const texto = mensagem.content
          .filter((bloco): bloco is Anthropic.TextBlock => bloco.type === "text")
          .map((bloco) => bloco.text)
          .join("");
        const validacao = esquemaDaRespostaDaIA.safeParse(lerJson(texto));
        if (validacao.success) {
          const resposta: RespostaDaIA = validacao.data;
          return { resposta, modelo: mensagem.model, tokens, tentativas: tentativa, mock: false };
        }
      }

      throw new ErroDaIA("formato_invalido", "A resposta da IA veio fora do formato esperado.", {
        tokens,
      });
    },
  };
}
