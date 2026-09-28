import "server-only";

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import { env } from "@/env";

/**
 * Assinaturas HMAC do app (D-028). Cada finalidade usa uma chave própria,
 * derivada do BETTER_AUTH_SECRET por HKDF: um segredo a menos para configurar,
 * e uma assinatura de uma finalidade nunca vale para outra (nem para os
 * cookies do Better Auth, que usam o segredo original).
 */

export type Finalidade = "hash-do-ip" | "carimbo-do-formulario";

const chaves = new Map<Finalidade, Buffer>();

function chaveDa(finalidade: Finalidade): Buffer {
  let chave = chaves.get(finalidade);
  if (!chave) {
    chave = Buffer.from(
      hkdfSync("sha256", env.BETTER_AUTH_SECRET, "brasa", `brasa:${finalidade}:v1`, 32),
    );
    chaves.set(finalidade, chave);
  }
  return chave;
}

/** HMAC-SHA256 do texto, em hexadecimal (64 caracteres). */
export function assinar(finalidade: Finalidade, texto: string): string {
  return createHmac("sha256", chaveDa(finalidade)).update(texto).digest("hex");
}

/** Confere uma assinatura em tempo constante (não vaza, pelo tempo, quantos caracteres batem). */
export function assinaturaConfere(
  finalidade: Finalidade,
  texto: string,
  assinatura: string,
): boolean {
  const esperada = Buffer.from(assinar(finalidade, texto));
  const recebida = Buffer.from(assinatura);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}
