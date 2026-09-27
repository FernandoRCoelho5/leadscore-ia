import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Tokens de link (convites, D-030): 32 bytes aleatórios (256 bits) em
 * base64url. O banco guarda só o SHA-256: quem lê o banco não consegue montar
 * o link. Com essa entropia, não é preciso HMAC nem "sal".
 */

const FORMATO_DO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function gerarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDoToken(token) };
}

/** Descarta de cara o que nem tem o formato de um token (sem consultar o banco). */
export function temFormatoDeToken(valor: string): boolean {
  return FORMATO_DO_TOKEN.test(valor);
}
