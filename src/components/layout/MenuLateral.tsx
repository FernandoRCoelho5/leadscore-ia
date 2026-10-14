"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, type ReactNode } from "react";

import { COOKIE_DO_MENU, VALOR_RECOLHIDO } from "@/lib/menu";

/** Um ano, como o cookie do tema. */
const UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365;

/**
 * Guarda a escolha no navegador. É só uma preferência visual, sem nada
 * sensível, e gravar daqui evita uma ida ao servidor (que recarregaria os
 * dados da página) a cada clique.
 */
function lembrar(recolhido: boolean) {
  const seguro = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = recolhido
    ? `${COOKIE_DO_MENU}=${VALOR_RECOLHIDO}; path=/; max-age=${UM_ANO_EM_SEGUNDOS}; samesite=lax${seguro}`
    : `${COOKIE_DO_MENU}=; path=/; max-age=0; samesite=lax${seguro}`;
}

/**
 * Menu lateral do computador, que pode ser recolhido até ficar só com os
 * ícones (o nome de cada item continua para leitores de tela e aparece numa
 * dica ao passar o mouse ou focar). A largura muda sem animação: animar a
 * largura refaria o layout da página inteira a cada quadro.
 */
export function MenuLateral({
  recolhidoInicial,
  children,
}: {
  recolhidoInicial: boolean;
  children: ReactNode;
}) {
  const [recolhido, setRecolhido] = useState(recolhidoInicial);

  function alternar() {
    setRecolhido(!recolhido);
    lembrar(!recolhido);
  }

  const Icone = recolhido ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      data-recolhido={recolhido}
      className="group/menu sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-borda bg-superficie data-[recolhido=true]:w-16 lg:flex"
    >
      {children}
      <div className="border-t border-borda p-3">
        <button
          type="button"
          onClick={alternar}
          className="flex h-controle w-full cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-texto-suave group-data-[recolhido=true]/menu:justify-center group-data-[recolhido=true]/menu:px-0 hover:bg-superficie-2 hover:text-texto"
        >
          <Icone aria-hidden="true" className="size-5 shrink-0" />
          {/* O texto diz o que o botão faz agora (sem aria-expanded, que diria o contrário). */}
          <span className="group-data-[recolhido=true]/menu:sr-only">
            {recolhido ? "Expandir menu" : "Recolher menu"}
          </span>
        </button>
      </div>
    </aside>
  );
}
