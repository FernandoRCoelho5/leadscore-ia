import { z } from "zod";

import { esquemaEmail, esquemaNome } from "./auth";

/**
 * Validação do formulário público de captação (D-028). As mesmas regras rodam
 * no navegador (resposta imediata) e na rota da API (a validação que vale).
 * Os tamanhos máximos seguem as colunas da tabela `leads`.
 */

/** Segmentos oferecidos no formulário: uma lista fixa deixa os relatórios comparáveis. */
export const SEGMENTOS = [
  "Indústria",
  "Comércio",
  "Serviços",
  "Tecnologia",
  "Saúde",
  "Educação",
  "Construção",
  "Agronegócio",
  "Setor público",
  "Outro",
] as const;

export const MENSAGEM_MINIMO = 10;
export const MENSAGEM_MAXIMO = 2000;

/** Versão do texto de consentimento; muda quando o texto mudar (fica gravada em cada lead). */
export const VERSAO_DO_CONSENTIMENTO = "v1";

/** Campo invisível para pessoas: robôs que preenchem tudo o preenchem (anti-spam, D-028). */
export const CAMPO_ARMADILHA = "website";
/** Campo oculto com o carimbo assinado do horário em que a página foi aberta. */
export const CAMPO_CARIMBO = "carimbo";

/** Campo opcional: vazio ou ausente (quem chama a API pode omitir) vira null. */
const vazioComoNulo = <Valor extends string>(valor: Valor | undefined): Valor | null =>
  valor === undefined || valor === "" ? null : valor;

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `Máximo de ${maximo} caracteres.`)
    .optional()
    .transform(vazioComoNulo);

const telefone = z
  .string()
  .trim()
  .max(30, "Telefone longo demais.")
  .refine((valor) => valor === "" || /^[\d\s()+.-]+$/.test(valor), {
    error: "Use só números, espaços, parênteses, + e -.",
    // Uma mensagem por vez: com caracteres inválidos, a contagem de dígitos não importa.
    abort: true,
  })
  .refine(
    (valor) => {
      if (valor === "") {
        return true;
      }
      const digitos = valor.replace(/\D/g, "").length;
      return digitos >= 10 && digitos <= 13;
    },
    { error: "Informe o telefone com DDD, como (24) 99999-0000." },
  )
  .optional()
  .transform(vazioComoNulo);

export const esquemaLeadPublico = z.object({
  nome: esquemaNome,
  email: esquemaEmail,
  telefone,
  empresaNome: textoOpcional(160),
  segmento: z
    .union([z.enum(SEGMENTOS), z.literal("")], { error: "Escolha um segmento da lista." })
    .optional()
    .transform(vazioComoNulo),
  mensagem: z
    .string()
    .trim()
    .min(MENSAGEM_MINIMO, `Conte em pelo menos ${MENSAGEM_MINIMO} caracteres o que você precisa.`)
    .max(MENSAGEM_MAXIMO, `Máximo de ${MENSAGEM_MAXIMO.toLocaleString("pt-BR")} caracteres.`),
  consentimento: z.literal("sim", {
    error: "Para enviar, marque que concorda com o uso dos seus dados.",
  }),
});

export type DadosDoLeadPublico = z.output<typeof esquemaLeadPublico>;
