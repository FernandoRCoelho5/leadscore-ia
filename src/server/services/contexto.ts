import type { Ator } from "@/server/auth/permissoes";

/**
 * Quem está pedindo a operação. Os serviços recebem este contexto em vez da
 * sessão do Next.js: assim as regras de negócio podem ser testadas sem
 * navegador nem cookies.
 */
export type ContextoDoUsuario = {
  usuarioId: string;
  ator: Ator;
};

/** O banco sinaliza violação de unicidade com o código 23505 (Postgres). */
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  let atual: unknown = erro;
  for (let nivel = 0; nivel < 5 && atual instanceof Object; nivel += 1) {
    if ("code" in atual && atual.code === "23505") {
      return true;
    }
    atual = "cause" in atual ? atual.cause : undefined;
  }
  return false;
}
