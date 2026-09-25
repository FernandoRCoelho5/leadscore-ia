import "server-only";

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * IDs vêm de URLs e formulários. Um valor que não é UUID faria o Postgres lançar
 * erro (500); com esta checagem o repositório responde "não encontrado".
 */
export function ehUuid(valor: string): boolean {
  return FORMATO_UUID.test(valor);
}

/**
 * Monta o padrão do ILIKE para buscar um trecho. Escapa os curingas do LIKE
 * (% e _) e a barra, para que o termo digitado seja tratado como texto literal.
 * (O valor em si vai como parâmetro da consulta, então não há SQL injection.)
 */
export function padraoDeBusca(termo: string): string {
  const escapado = termo.trim().replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
  return `%${escapado}%`;
}
