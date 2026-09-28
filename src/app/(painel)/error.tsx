"use client";

import { TelaDeErro } from "@/components/ui/TelaDeErro";

/** Erro inesperado numa tela do painel: o menu continua, e dá para tentar de novo. */
export default function ErroNoPainel({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <TelaDeErro
      codigo={error.digest}
      aoTentarDeNovo={retry}
      destino={{ href: "/painel", rotulo: "Ir para a visão geral" }}
    />
  );
}
