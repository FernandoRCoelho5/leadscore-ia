import "server-only";

import type { EntradaDaAnalise } from "./prompt";
import type { RespostaDaIA } from "./schema";

/**
 * Contrato comum dos motores de análise (D-027): o real (Claude API) e o
 * simulado (mock). O serviço de análise não sabe qual está usando.
 */

export type TokensUsados = { entrada: number; saida: number };

export type ResultadoDoMotor = {
  resposta: RespostaDaIA;
  modelo: string;
  tokens: TokensUsados;
  tentativas: number;
  mock: boolean;
};

export type MotorDeAnalise = {
  analisar(entrada: EntradaDaAnalise): Promise<ResultadoDoMotor>;
};

/**
 * Por que a análise falhou. As mensagens vão para o log, nunca para o lead;
 * nenhuma delas contém dados pessoais.
 */
export type MotivoDaFalha =
  | "recusa" // a IA recusou responder (stop_reason "refusal")
  | "resposta_cortada" // atingiu o limite de tokens de saída
  | "formato_invalido" // JSON fora do schema, mesmo após nova tentativa
  | "indisponivel" // rede, 429 ou 5xx após as novas tentativas do SDK
  | "requisicao_recusada"; // 4xx da API (chave, créditos, parâmetros)

export class ErroDaIA extends Error {
  readonly motivo: MotivoDaFalha;
  /** Tokens cobrados mesmo sem resultado (entram no controle de custo). */
  readonly tokens: TokensUsados;

  constructor(
    motivo: MotivoDaFalha,
    mensagem: string,
    opcoes: { tokens?: TokensUsados; causa?: unknown } = {},
  ) {
    super(mensagem, { cause: opcoes.causa });
    this.name = "ErroDaIA";
    this.motivo = motivo;
    this.tokens = opcoes.tokens ?? { entrada: 0, saida: 0 };
  }
}
