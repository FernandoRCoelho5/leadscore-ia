"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Botao } from "./Botao";
import { useToasts } from "./Toasts";

type Estado = "parado" | "copiado" | "falhou";

/**
 * Copia um texto para a área de transferência. O botão vira "Copiado" e um
 * toast confirma (e é anunciado aos leitores de tela); se o navegador não
 * permitir, a mensagem ao lado pede para copiar à mão.
 *
 * `confirmacao`: o que o toast diz (ex.: "Resposta copiada.").
 */
export function BotaoCopiar({
  texto,
  rotulo,
  confirmacao = "Copiado para a área de transferência.",
}: {
  texto: string;
  rotulo: string;
  confirmacao?: string;
}) {
  const [estado, setEstado] = useState<Estado>("parado");
  const { avisar } = useToasts();

  useEffect(() => {
    if (estado === "parado") {
      return;
    }
    const temporizador = setTimeout(() => setEstado("parado"), 3000);
    return () => clearTimeout(temporizador);
  }, [estado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
      avisar("sucesso", confirmacao);
    } catch {
      setEstado("falhou");
    }
  }

  const Icone = estado === "copiado" ? Check : Copy;
  return (
    <div className="flex flex-col items-start gap-1">
      <Botao variante="contorno" onClick={copiar}>
        <Icone aria-hidden="true" className="size-4" />
        {estado === "copiado" ? "Copiado" : rotulo}
      </Botao>
      <p role="status" className="text-xs text-texto-suave empty:hidden">
        {estado === "falhou" && "Não foi possível copiar. Selecione o texto e copie à mão."}
      </p>
    </div>
  );
}
