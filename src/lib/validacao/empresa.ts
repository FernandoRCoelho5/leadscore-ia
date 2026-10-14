import { z } from "./zod";

import { SLUG_MAXIMO, SLUG_MINIMO, gerarSlug } from "./regras";

/** Validações da empresa e do perfil do negócio (contexto que a IA usa para pontuar). */

export { SLUG_MAXIMO, SLUG_MINIMO, gerarSlug };

const FORMATO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo de ${maximo} caracteres.`)
    .transform((valor) => (valor === "" ? null : valor));

export const esquemaPerfilDoNegocio = z.object({
  descricao: z
    .string()
    .trim()
    .min(20, "Descreva o negócio em pelo menos 20 caracteres: a IA usa isso para pontuar.")
    .max(1000, "Máximo de 1.000 caracteres."),
  produtosServicos: textoOpcional(1000),
  clienteIdeal: z
    .string()
    .trim()
    .min(20, "Descreva o cliente ideal em pelo menos 20 caracteres.")
    .max(1000, "Máximo de 1.000 caracteres."),
  ticketMedioReais: z
    .string()
    .trim()
    .transform((valor) =>
      valor === "" ? null : Number(valor.replace(/\./g, "").replace(",", ".")),
    )
    .pipe(
      z
        .number({ error: "Informe um valor em reais, como 4500." })
        .int("Use um valor inteiro em reais.")
        .min(0, "O valor não pode ser negativo.")
        .max(100_000_000, "Valor alto demais.")
        .nullable(),
    ),
  regioesAtendidas: textoOpcional(500),
});

export const esquemaOnboarding = esquemaPerfilDoNegocio.extend({
  nomeEmpresa: z
    .string()
    .trim()
    .min(2, "Informe o nome da empresa.")
    .max(120, "Nome longo demais (máximo de 120 caracteres)."),
  slug: z
    .string()
    .trim()
    .min(SLUG_MINIMO, `O endereço precisa ter pelo menos ${SLUG_MINIMO} caracteres.`)
    .max(SLUG_MAXIMO, `O endereço pode ter no máximo ${SLUG_MAXIMO} caracteres.`)
    .regex(FORMATO_SLUG, "Use só letras minúsculas, números e hífens (ex.: minha-empresa)."),
});

export type DadosDoPerfilDoNegocio = z.infer<typeof esquemaPerfilDoNegocio>;
export type DadosDoOnboarding = z.infer<typeof esquemaOnboarding>;

/** Só os campos do passo "Sua empresa" do onboarding, validados antes de seguir. */
export const esquemaDaEmpresaNoOnboarding = esquemaOnboarding.pick({
  nomeEmpresa: true,
  slug: true,
});
