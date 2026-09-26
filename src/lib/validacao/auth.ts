import { z } from "zod";

/**
 * Validações dos formulários de conta. As mesmas regras rodam no navegador
 * (resposta imediata) e no servidor (a validação que vale).
 */

export const SENHA_MINIMO = 10;
export const SENHA_MAXIMO = 128;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail longo demais.")
  .pipe(z.email("Informe um e-mail válido, como nome@empresa.com.br."));

const senhaNova = z
  .string()
  .min(SENHA_MINIMO, `A senha precisa ter pelo menos ${SENHA_MINIMO} caracteres.`)
  .max(SENHA_MAXIMO, `A senha pode ter no máximo ${SENHA_MAXIMO} caracteres.`);

export const esquemaNome = z
  .string()
  .trim()
  .min(2, "Informe o seu nome.")
  .max(120, "Nome longo demais (máximo de 120 caracteres).");

export const esquemaCadastro = z.object({
  nome: esquemaNome,
  email,
  senha: senhaNova,
});

export const esquemaLogin = z.object({
  email,
  senha: z.string().min(1, "Informe a sua senha.").max(SENHA_MAXIMO),
});

export const esquemaEsqueciSenha = z.object({ email });

export const esquemaNovaSenha = z
  .object({
    senha: senhaNova,
    confirmacao: z.string(),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    path: ["confirmacao"],
    error: "As senhas não conferem.",
  });

export const esquemaTrocaDeSenha = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual."),
    senha: senhaNova,
    confirmacao: z.string(),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    path: ["confirmacao"],
    error: "As senhas não conferem.",
  });

/**
 * Destino depois do login: só caminhos internos. Evita "open redirect"
 * (um link de login que mandaria a pessoa para um site falso).
 */
export function destinoSeguro(proximo: string | null | undefined): string {
  if (proximo && proximo.startsWith("/") && !proximo.startsWith("//") && !proximo.includes("\\")) {
    return proximo;
  }
  return "/painel";
}
