import "server-only";

import { unstable_rethrow } from "next/navigation";

import { traduzirErro, type CorpoDeErro } from "./responder";

/**
 * Resultado padronizado das Server Actions. A tela recebe sempre `ok: true`
 * com os dados ou `ok: false` com o mesmo formato de erro das rotas de API,
 * sem exceções atravessando para o navegador.
 */
export type ResultadoDeAcao<T> = { ok: true; dados: T } | ({ ok: false } & CorpoDeErro);

export async function executarAcao<T>(acao: () => Promise<T>): Promise<ResultadoDeAcao<T>> {
  const requestId = crypto.randomUUID();
  try {
    return { ok: true, dados: await acao() };
  } catch (erro) {
    // redirect() e notFound() funcionam lançando erros internos do Next.js;
    // eles precisam continuar subindo para funcionar.
    unstable_rethrow(erro);
    const { corpo } = traduzirErro(erro, requestId);
    return { ok: false, ...corpo };
  }
}
