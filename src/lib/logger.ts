/**
 * Logger estruturado: cada linha é um objeto JSON, formato que a Vercel indexa
 * e permite filtrar. Antes de escrever, campos sensíveis (senhas, tokens,
 * chaves, e-mail, telefone...) são substituídos por "[oculto]", para que dados
 * pessoais e segredos nunca cheguem aos logs.
 */

type Nivel = "debug" | "info" | "warn" | "error";

export type ContextoDeLog = Record<string, unknown>;

const CHAVES_SENSIVEIS =
  /senha|password|token|secret|segredo|authorization|cookie|api[-_]?key|database[-_]?url|email|telefone|cpf|^ip$/i;
const OCULTO = "[oculto]";
const PROFUNDIDADE_MAXIMA = 5;

/** Copia o valor ocultando chaves sensíveis, em qualquer nível de aninhamento. */
export function ocultarSensiveis(valor: unknown, profundidade = 0): unknown {
  if (profundidade > PROFUNDIDADE_MAXIMA) {
    return "[...]";
  }
  if (typeof valor === "bigint") {
    return valor.toString();
  }
  if (valor instanceof Error) {
    return {
      nome: valor.name,
      mensagem: valor.message,
      pilha: valor.stack,
      ...(valor.cause !== undefined && {
        causa: ocultarSensiveis(valor.cause, profundidade + 1),
      }),
    };
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => ocultarSensiveis(item, profundidade + 1));
  }
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, item]) => [
        chave,
        CHAVES_SENSIVEIS.test(chave) ? OCULTO : ocultarSensiveis(item, profundidade + 1),
      ]),
    );
  }
  return valor;
}

function escrever(nivel: Nivel, mensagem: string, contexto: ContextoDeLog = {}) {
  if (nivel === "debug" && process.env.NODE_ENV === "production") {
    return;
  }

  const linha = JSON.stringify({
    ...(ocultarSensiveis(contexto) as ContextoDeLog),
    nivel,
    mensagem,
    horario: new Date().toISOString(),
  });

  if (nivel === "error") {
    console.error(linha);
  } else if (nivel === "warn") {
    console.warn(linha);
  } else {
    console.log(linha);
  }
}

export const logger = {
  debug: (mensagem: string, contexto?: ContextoDeLog) => escrever("debug", mensagem, contexto),
  info: (mensagem: string, contexto?: ContextoDeLog) => escrever("info", mensagem, contexto),
  warn: (mensagem: string, contexto?: ContextoDeLog) => escrever("warn", mensagem, contexto),
  error: (mensagem: string, contexto?: ContextoDeLog) => escrever("error", mensagem, contexto),
};
