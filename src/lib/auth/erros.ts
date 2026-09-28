import { SENHA_MAXIMO, SENHA_MINIMO } from "@/lib/validacao/auth";

/** Erro devolvido pelas rotas de autenticação (Better Auth). */
export type ErroDeAutenticacao = { code?: string | undefined; status: number; message?: string };

const MENSAGENS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_EMAIL: "Informe um e-mail válido.",
  INVALID_PASSWORD: "A senha atual está incorreta.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Entre ou redefina a senha.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Já existe uma conta com este e-mail. Entre ou redefina a senha.",
  PASSWORD_TOO_SHORT: `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`,
  PASSWORD_TOO_LONG: `A senha pode ter no máximo ${SENHA_MAXIMO} caracteres.`,
  INVALID_TOKEN: "Este link não é mais válido. Peça um novo.",
  TOKEN_EXPIRED: "Este link expirou. Peça um novo.",
  CONTA_BLOQUEADA: "Esta conta está bloqueada. Fale com o suporte.",
  DADOS_INVALIDOS: "Confira o nome e o e-mail.",
};

/** Traduz o erro para uma mensagem curta em português, sem detalhes técnicos. */
export function mensagemDoErroDeAutenticacao(erro: ErroDeAutenticacao): string {
  if (erro.status === 429) {
    return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  }
  return (erro.code && MENSAGENS[erro.code]) || "Não foi possível concluir agora. Tente de novo.";
}
