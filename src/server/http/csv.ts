import "server-only";

import { BOM, linhaCsv, nomeDoArquivo, type ValorDeCelula } from "@/lib/csv";
import { logger } from "@/lib/logger";

/**
 * Resposta CSV transmitida aos poucos (streaming, D-029): cada lote lido do
 * banco vira linhas e é enviado na hora. A memória do servidor fica constante,
 * com 50 ou 50 mil linhas.
 */
export function respostaCsv<Item>({
  prefixoDoArquivo,
  cabecalho,
  lotes,
  linha,
}: {
  prefixoDoArquivo: string;
  cabecalho: readonly string[];
  lotes: AsyncGenerator<Item[]>;
  linha: (item: Item) => readonly ValorDeCelula[];
}): Response {
  const codificador = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    start(controle) {
      controle.enqueue(codificador.encode(BOM + linhaCsv(cabecalho)));
    },
    async pull(controle) {
      try {
        const { value: lote, done } = await lotes.next();
        if (done) {
          controle.close();
          return;
        }
        controle.enqueue(codificador.encode(lote.map((item) => linhaCsv(linha(item))).join("")));
      } catch (erro) {
        // O cabeçalho HTTP já foi enviado: não dá para trocar por um 500. O
        // arquivo fica incompleto e o erro vai para o log.
        logger.error("Falha ao gerar o CSV", { prefixoDoArquivo, erro });
        controle.error(erro);
      }
    },
    async cancel() {
      await lotes.return(undefined);
    },
  });

  return new Response(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeDoArquivo(prefixoDoArquivo)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
