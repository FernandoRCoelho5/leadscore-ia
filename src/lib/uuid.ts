/**
 * Gera um UUID versão 7 (RFC 9562).
 *
 * Os primeiros 48 bits são o horário em milissegundos e o restante é aleatório.
 * Vantagens sobre o UUID v4 (totalmente aleatório): os IDs novos ficam em ordem
 * de criação, o que mantém os índices do banco compactos em tabelas grandes;
 * e, como no v4, continuam impossíveis de adivinhar (dificulta ataques IDOR).
 */
export function uuidv7(agoraEmMs: number = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const visao = new DataView(bytes.buffer);

  // Bytes 0 a 5: horário (48 bits, big-endian).
  visao.setUint32(0, Math.floor(agoraEmMs / 2 ** 16));
  visao.setUint16(4, agoraEmMs % 2 ** 16);
  // Byte 6: versão 7 nos 4 bits mais altos.
  visao.setUint8(6, (visao.getUint8(6) & 0x0f) | 0x70);
  // Byte 8: variante RFC (bits 10).
  visao.setUint8(8, (visao.getUint8(8) & 0x3f) | 0x80);

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
