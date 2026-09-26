import "server-only";

import { assinar } from "./chaves";

/** Maior representação textual de um endereço IP (IPv6 com IPv4 embutido). */
const TAMANHO_MAXIMO_DO_IP = 45;

/**
 * IP de quem fez a requisição. Na Vercel, o `x-forwarded-for` é preenchido
 * pela própria plataforma (o valor enviado pelo navegador é substituído), e o
 * primeiro endereço é o do visitante. Em outra hospedagem, atrás de outro
 * proxy, esta leitura precisa ser revista (D-028). O mesmo cabeçalho é o que o
 * Better Auth usa no limite de tentativas do login.
 */
export function obterIp(cabecalhos: Headers): string | null {
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = encaminhado || cabecalhos.get("x-real-ip")?.trim();
  return ip && ip.length <= TAMANHO_MAXIMO_DO_IP ? ip : null;
}

/**
 * O IP nunca é gravado puro (D-009): só este HMAC, que serve para contar
 * tentativas e comparar envios, mas não pode ser revertido sem o segredo.
 */
export function hashDoIp(ip: string): string {
  return assinar("hash-do-ip", ip);
}
