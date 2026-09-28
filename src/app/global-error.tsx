"use client";

import "./globals.css";

import { TelaDeErro } from "@/components/ui/TelaDeErro";

/**
 * Último recurso: erro no layout raiz. Substitui o layout inteiro, por isso
 * traz o próprio <html> (no tema claro, o padrão do produto).
 */
export default function ErroGeral({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="pt-BR" data-tema="claro">
      <body className="flex min-h-full flex-col">
        <main id="conteudo" className="flex flex-1 flex-col">
          <TelaDeErro codigo={error.digest} aoTentarDeNovo={retry} />
        </main>
      </body>
    </html>
  );
}
