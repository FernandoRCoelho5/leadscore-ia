"use client";

import { TelaDeErro } from "@/components/ui/TelaDeErro";

/** Erro inesperado nas páginas públicas (as do painel têm a própria tela, com o menu). */
export default function Erro({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main id="conteudo" className="flex flex-1 flex-col">
      <TelaDeErro codigo={error.digest} aoTentarDeNovo={retry} />
    </main>
  );
}
