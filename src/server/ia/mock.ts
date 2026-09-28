import "server-only";

import type { MotorDeAnalise } from "./motor";
import type { EntradaDaAnalise } from "./prompt";
import { classificacaoDaNota } from "./schema";

/**
 * Motor simulado (IA_MODO=mock, padrão no desenvolvimento e no CI): regras
 * simples e determinísticas, sem custo e sem rede. Serve para a demonstração
 * e os testes; a análise gravada fica marcada como `mock`.
 */

const INTENCAO = [
  "orçamento",
  "orcamento",
  "proposta",
  "contratar",
  "preço",
  "preco",
  "valor",
  "reunião",
  "reuniao",
  "demonstração",
  "demonstracao",
  "urgente",
  "prazo",
  "projeto",
];

const SPAM = [
  "http://",
  "https://",
  "grátis",
  "gratis",
  "ganhe",
  "promoção",
  "promocao",
  "vaga",
  "currículo",
  "curriculo",
];

/** Palavras comuns demais para indicar aderência ao perfil. */
const COMUNS = new Set([
  "empres",
  "nossa",
  "nosso",
  "sobre",
  "gostar",
  "precis",
  "querem",
  "quero",
]);

/**
 * Radicais (6 primeiras letras, sem acento) das palavras com 5 letras ou mais:
 * "Indústria" e "indústrias" viram o mesmo radical.
 */
function radicais(texto: string | null): Set<string> {
  const normalizado = (texto ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const encontrados = (normalizado.match(/[a-z0-9]{5,}/g) ?? []).map((palavra) =>
    palavra.slice(0, 6),
  );
  return new Set(encontrados.filter((radical) => !COMUNS.has(radical)));
}

export function notaSimulada({ perfil, lead }: EntradaDaAnalise): {
  score: number;
  sinais: string[];
} {
  const mensagem = (lead.mensagem ?? "").toLowerCase();
  const sinais: string[] = [];
  let score = 30;

  const intencoes = INTENCAO.filter((termo) => mensagem.includes(termo));
  if (intencoes.length > 0) {
    score += Math.min(32, 20 + (intencoes.length - 1) * 6);
    sinais.push("demonstra intenção de compra");
  }
  if (mensagem.length >= 60) {
    score += 10;
    sinais.push("descreve a necessidade com detalhes");
  }
  if (lead.empresaNome) {
    score += 5;
    sinais.push("informou a empresa");
  }

  const doPerfil = radicais(`${perfil.clienteIdeal ?? ""} ${perfil.descricao ?? ""}`);
  const doLead = radicais(`${lead.segmento ?? ""} ${lead.mensagem ?? ""}`);
  if ([...doLead].some((palavra) => doPerfil.has(palavra))) {
    score += 15;
    sinais.push("tem aderência ao cliente ideal");
  }

  if (SPAM.some((termo) => mensagem.includes(termo)) || mensagem.trim().length < 15) {
    score -= 25;
    sinais.push("tem sinais de spam ou mensagem vaga");
  }

  return { score: Math.max(0, Math.min(100, score)), sinais };
}

export const motorSimulado: MotorDeAnalise = {
  async analisar(entrada) {
    const { score, sinais } = notaSimulada(entrada);
    const classificacao = classificacaoDaNota(score);
    const empresa = entrada.perfil.nomeEmpresa;

    const justificativa =
      sinais.length > 0
        ? `Análise simulada: o lead ${sinais.join(", ")}. Nota ${score}, classificação ${classificacao}.`
        : `Análise simulada: o lead não trouxe sinais claros de interesse. Nota ${score}, classificação ${classificacao}.`;

    const respostaSugerida =
      classificacao === "frio"
        ? `Olá! Obrigado pelo contato com a ${empresa}. Recebemos a sua mensagem e, se fizer sentido para o seu momento, ficamos à disposição para conversar.\n\nEquipe ${empresa}`
        : `Olá! Obrigado pelo interesse na ${empresa}. Gostaríamos de entender melhor a sua necessidade: podemos marcar uma conversa rápida nesta semana?\n\nEquipe ${empresa}`;

    return {
      resposta: { score, justificativa, respostaSugerida },
      modelo: "mock",
      tokens: { entrada: 0, saida: 0 },
      tentativas: 1,
      mock: true,
    };
  },
};
