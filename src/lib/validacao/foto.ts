/**
 * Regras da foto de perfil, usadas no navegador (resposta imediata) e no
 * servidor (a validação que vale).
 *
 * O tipo é identificado pelos primeiros bytes do arquivo (a "assinatura"),
 * nunca pela extensão nem pelo tipo que o navegador informa: um arquivo
 * "foto.png" que na verdade é HTML ou SVG é recusado.
 */

/** Tamanho máximo do arquivo recebido pelo servidor: 2 MB. */
export const FOTO_TAMANHO_MAXIMO = 2 * 1024 * 1024;

/** Lado máximo, em pixels, da foto ajustada no navegador antes do envio. */
export const FOTO_LADO_MAXIMO = 512;

export const TIPOS_DE_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoDeFoto = (typeof TIPOS_DE_FOTO)[number];

export const EXTENSAO_DO_TIPO: Record<TipoDeFoto, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Quantos bytes do início do arquivo bastam para reconhecer o tipo. */
export const BYTES_DA_ASSINATURA = 12;

function comecaCom(bytes: Uint8Array, assinatura: readonly number[], inicio = 0): boolean {
  return assinatura.every((byte, posicao) => bytes[inicio + posicao] === byte);
}

const ascii = (texto: string) => [...texto].map((caractere) => caractere.charCodeAt(0));

/** Tipo real da imagem pelos bytes iniciais, ou `null` se não for JPEG, PNG nem WebP. */
export function tipoRealDaImagem(bytes: Uint8Array): TipoDeFoto | null {
  // JPEG: FF D8 FF
  if (comecaCom(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  // PNG: 89 "PNG" 0D 0A 1A 0A
  if (comecaCom(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // WebP: "RIFF", 4 bytes de tamanho e "WEBP"
  if (comecaCom(bytes, ascii("RIFF")) && comecaCom(bytes, ascii("WEBP"), 8)) {
    return "image/webp";
  }
  return null;
}

export type ProblemaNaFoto = "vazia" | "grande" | "tipo";

export const MENSAGEM_DO_PROBLEMA: Record<ProblemaNaFoto, string> = {
  vazia: "Escolha uma foto.",
  grande: `A foto pode ter no máximo ${FOTO_TAMANHO_MAXIMO / 1024 / 1024} MB.`,
  tipo: "Use uma imagem JPEG, PNG ou WebP.",
};

export type ResultadoDaValidacaoDeFoto =
  { ok: true; tipo: TipoDeFoto } | { ok: false; problema: ProblemaNaFoto };

/** Confere tamanho e tipo real do arquivo inteiro. */
export function validarFoto(bytes: Uint8Array): ResultadoDaValidacaoDeFoto {
  if (bytes.length === 0) {
    return { ok: false, problema: "vazia" };
  }
  if (bytes.length > FOTO_TAMANHO_MAXIMO) {
    return { ok: false, problema: "grande" };
  }
  const tipo = tipoRealDaImagem(bytes);
  return tipo ? { ok: true, tipo } : { ok: false, problema: "tipo" };
}
