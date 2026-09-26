import "server-only";

import { assinar, assinaturaConfere } from "./chaves";

/**
 * Carimbo do formulário público (D-028): o horário em que a página foi aberta,
 * assinado pelo servidor e ligado à empresa. Com ele, o envio prova que veio
 * de uma página carregada há um tempo plausível: robôs que postam direto na
 * API precisam abrir a página antes, e quem envia rápido demais é descartado.
 *
 * Formato: "<milissegundos>.<HMAC de empresaId.milissegundos>".
 */

export function criarCarimbo(empresaId: string, agora: Date = new Date()): string {
  const instante = String(agora.getTime());
  return `${instante}.${assinar("carimbo-do-formulario", `${empresaId}.${instante}`)}`;
}

export type LeituraDoCarimbo = { valido: false } | { valido: true; idadeMs: number };

export function lerCarimbo(
  carimbo: unknown,
  empresaId: string,
  agora: Date = new Date(),
): LeituraDoCarimbo {
  if (typeof carimbo !== "string" || carimbo.length > 100) {
    return { valido: false };
  }
  const [instante, assinatura, ...sobra] = carimbo.split(".");
  if (!instante || !assinatura || sobra.length > 0 || !/^\d{1,15}$/.test(instante)) {
    return { valido: false };
  }
  if (!assinaturaConfere("carimbo-do-formulario", `${empresaId}.${instante}`, assinatura)) {
    return { valido: false };
  }
  const idadeMs = agora.getTime() - Number(instante);
  // Carimbo "do futuro": relógio adulterado. Uma pequena folga cobre servidores diferentes.
  return idadeMs < -5_000 ? { valido: false } : { valido: true, idadeMs };
}
