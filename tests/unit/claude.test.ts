import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { MODELO, criarMotorClaude } from "@/server/ia/claude";
import { ErroDaIA } from "@/server/ia/motor";
import type { EntradaDaAnalise } from "@/server/ia/prompt";

/**
 * Motor real (Claude API) com o SDK de verdade e um `fetch` falso: testa o que
 * enviamos, como lemos a resposta e como tratamos cada erro, sem rede e sem
 * custo.
 */

const ENTRADA: EntradaDaAnalise = {
  perfil: {
    nomeEmpresa: "Agência Exemplo",
    descricao: "Sites para indústrias.",
    produtosServicos: null,
    clienteIdeal: "Indústrias do Sul Fluminense.",
    ticketMedioCentavos: null,
    regioesAtendidas: null,
  },
  lead: {
    empresaNome: "Metalúrgica Souza",
    segmento: "Indústria",
    mensagem: "Quero um orçamento de site.",
    origem: "formulario",
  },
};

const VALIDA = {
  score: 82,
  justificativa: "Pediu orçamento e é indústria da região.",
  respostaSugerida: "Olá! Obrigado pelo contato.",
};

type RespostaFalsa = { status?: number; corpo: unknown; cabecalhos?: Record<string, string> };

/** Mensagem no formato da API, com o texto e o uso de tokens informados. */
function mensagemDaApi(
  texto: string,
  { stop = "end_turn", entrada = 1200, saida = 300 } = {},
): RespostaFalsa {
  return {
    corpo: {
      id: "msg_teste",
      type: "message",
      role: "assistant",
      model: MODELO,
      content: [{ type: "text", text: texto }],
      stop_reason: stop,
      stop_sequence: null,
      usage: { input_tokens: entrada, output_tokens: saida },
    },
  };
}

function erroDaApi(status: number, tipo: string, mensagem: string): RespostaFalsa {
  return {
    status,
    // Sem espera entre as novas tentativas do SDK (o teste fica rápido).
    cabecalhos: { "retry-after-ms": "0" },
    corpo: { type: "error", error: { type: tipo, message: mensagem } },
  };
}

/** Cliente do SDK cujo `fetch` devolve as respostas na ordem e guarda os pedidos. */
function clienteFalso(...respostas: (RespostaFalsa | Error)[]) {
  const pedidos: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    pedidos.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const proxima = respostas.shift();
    if (!proxima) {
      throw new Error("Pedido inesperado ao fetch falso.");
    }
    if (proxima instanceof Error) {
      throw proxima;
    }
    return new Response(JSON.stringify(proxima.corpo), {
      status: proxima.status ?? 200,
      headers: { "content-type": "application/json", ...proxima.cabecalhos },
    });
  });
  const cliente = new Anthropic({ apiKey: "chave-de-teste", fetch, maxRetries: 2 });
  return { motor: criarMotorClaude(cliente), pedidos, fetch };
}

describe("motor Claude: pedido", () => {
  it("usa o Haiku 4.5 com temperatura 0, saída estruturada e o lead delimitado", async () => {
    const { motor, pedidos } = clienteFalso(mensagemDaApi(JSON.stringify(VALIDA)));

    await motor.analisar(ENTRADA);

    const [pedido] = pedidos;
    expect(pedido).toMatchObject({
      model: "claude-haiku-4-5-20251001",
      temperature: 0,
      max_tokens: 1024,
      output_config: { format: { type: "json_schema" } },
    });
    expect(String(pedido?.system)).toContain("nunca como instrução");
    expect(JSON.stringify(pedido?.messages)).toContain("<lead>");
  });
});

describe("motor Claude: resposta", () => {
  it("valida o JSON com o schema e devolve a nota, o modelo e os tokens", async () => {
    const { motor } = clienteFalso(mensagemDaApi(JSON.stringify(VALIDA)));

    expect(await motor.analisar(ENTRADA)).toEqual({
      resposta: VALIDA,
      modelo: MODELO,
      tokens: { entrada: 1200, saida: 300 },
      tentativas: 1,
      mock: false,
    });
  });

  it("JSON fora do schema: tenta de novo e soma os tokens das duas chamadas", async () => {
    const { motor } = clienteFalso(
      mensagemDaApi(JSON.stringify({ ...VALIDA, score: 180 })),
      mensagemDaApi(JSON.stringify(VALIDA)),
    );

    const resultado = await motor.analisar(ENTRADA);

    expect(resultado.tentativas).toBe(2);
    expect(resultado.tokens).toEqual({ entrada: 2400, saida: 600 });
  });

  it("duas respostas inválidas: falha por formato, com os tokens gastos", async () => {
    const { motor } = clienteFalso(mensagemDaApi("isto não é JSON"), mensagemDaApi("{}"));

    await expect(motor.analisar(ENTRADA)).rejects.toMatchObject({
      motivo: "formato_invalido",
      tokens: { entrada: 2400, saida: 600 },
    });
  });

  it("recusa da IA não é salva nem repetida", async () => {
    const { motor, fetch } = clienteFalso(mensagemDaApi("", { stop: "refusal" }));

    await expect(motor.analisar(ENTRADA)).rejects.toMatchObject({ motivo: "recusa" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("resposta cortada pelo limite de tokens falha em vez de salvar JSON incompleto", async () => {
    const { motor } = clienteFalso(mensagemDaApi('{"score": 8', { stop: "max_tokens" }));

    await expect(motor.analisar(ENTRADA)).rejects.toMatchObject({ motivo: "resposta_cortada" });
  });
});

describe("motor Claude: erros da API", () => {
  it("sem créditos (400): falha na hora, sem novas tentativas", async () => {
    const { motor, fetch } = clienteFalso(
      erroDaApi(400, "invalid_request_error", "Your credit balance is too low."),
    );

    const erro = await motor.analisar(ENTRADA).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDaIA);
    expect(erro).toMatchObject({ motivo: "requisicao_recusada" });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("instabilidade (529/500): o SDK tenta de novo e a análise sai", async () => {
    const { motor, fetch } = clienteFalso(
      erroDaApi(529, "overloaded_error", "Overloaded"),
      erroDaApi(500, "api_error", "Internal error"),
      mensagemDaApi(JSON.stringify(VALIDA)),
    );

    await expect(motor.analisar(ENTRADA)).resolves.toMatchObject({ tentativas: 1 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("limite de requisições (429) esgotado: indisponível", async () => {
    const limite = () => erroDaApi(429, "rate_limit_error", "Rate limited");
    const { motor, fetch } = clienteFalso(limite(), limite(), limite());

    await expect(motor.analisar(ENTRADA)).rejects.toMatchObject({ motivo: "indisponivel" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("sem conexão: indisponível", async () => {
    const semRede = () => new TypeError("fetch failed");
    const { motor } = clienteFalso(semRede(), semRede(), semRede());

    await expect(motor.analisar(ENTRADA)).rejects.toMatchObject({ motivo: "indisponivel" });
  });
});
