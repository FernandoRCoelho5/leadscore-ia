"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/**
 * No celular, os filtros ficam recolhidos atrás de um botão, para a lista
 * aparecer logo no topo da tela; do tablet para cima, ficam sempre à vista.
 * Com filtro aplicado, começam abertos, para mostrar o que está valendo.
 */
export function FiltrosRecolhiveis({
  temFiltro,
  children,
}: {
  temFiltro: boolean;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(temFiltro);
  const id = useId();

  return (
    <div className="mb-4">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto(!aberto)}
        className="flex h-controle w-full cursor-pointer items-center gap-2 rounded-lg border border-borda bg-superficie px-4 text-sm font-semibold hover:bg-superficie-2 md:hidden"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4 text-texto-suave" />
        Buscar e filtrar
        {temFiltro && (
          <span className="rounded-full bg-quente-fundo px-2 py-0.5 text-xs text-quente-texto">
            com filtros
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={`ml-auto size-4 text-texto-suave transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>
      <div id={id} className={`${aberto ? "mt-2 animate-entrar" : "hidden"} md:mt-0 md:block`}>
        {children}
      </div>
    </div>
  );
}
