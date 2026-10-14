/**
 * Limites e listas dos formulários, sem depender do Zod: os componentes do
 * navegador importam daqui para mostrar contadores, listas e dicas, e o Zod
 * (o maior pacote do navegador) só é baixado quando o formulário precisa
 * validar (D-040). Os esquemas em `auth.ts`, `lead.ts` e `empresa.ts` usam
 * estes mesmos valores, então navegador e servidor nunca divergem.
 */

// Conta (auth.ts)
export const SENHA_MINIMO = 10;
export const SENHA_MAXIMO = 128;

// Formulário público de captação (lead.ts)

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

/** Campo invisível para pessoas: robôs que preenchem tudo o preenchem (anti-spam, D-028). */
export const CAMPO_ARMADILHA = "website";
/** Campo oculto com o carimbo assinado do horário em que a página foi aberta. */
export const CAMPO_CARIMBO = "carimbo";

// Empresa (empresa.ts)
export const SLUG_MINIMO = 3;
export const SLUG_MAXIMO = 60;

/** Gera o endereço do formulário a partir do nome: "Agência Pixel" -> "agencia-pixel". */
export function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAXIMO)
    .replace(/-+$/g, "");
}
