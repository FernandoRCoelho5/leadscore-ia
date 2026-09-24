/**
 * Executado uma vez quando o servidor Next.js inicia.
 * Importar o módulo de ambiente dispara a validação: se faltar alguma
 * variável, o servidor não sobe.
 */
export async function register() {
  await import("./env");
}
