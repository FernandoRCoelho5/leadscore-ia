"use client";

import { RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Botao } from "@/components/ui/Botao";

/**
 * Controles do catálogo: repetir as animações de entrada (remonta o conteúdo)
 * e simular o movimento reduzido (`data-movimento="reduzido"`, a mesma regra
 * de quem ativa "reduzir movimento" no sistema).
 */
export function Vitrine({ children }: { children: ReactNode }) {
  const [rodada, setRodada] = useState(0);
  const [reduzido, setReduzido] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Controles do catálogo">
        <Botao variante="contorno" onClick={() => setRodada((n) => n + 1)}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Repetir entradas
        </Botao>
        <Botao
          variante="contorno"
          aria-pressed={reduzido}
          onClick={() => setReduzido((atual) => !atual)}
          className="aria-pressed:border-primaria aria-pressed:text-marca-texto"
        >
          Simular movimento reduzido
        </Botao>
      </div>
      <div
        key={rodada}
        data-movimento={reduzido ? "reduzido" : undefined}
        className="flex flex-col gap-12"
      >
        {children}
      </div>
    </div>
  );
}
