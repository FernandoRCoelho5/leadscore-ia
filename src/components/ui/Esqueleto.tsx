import type { ReactNode } from "react";

/**
 * Esqueletos de carregamento "quentes" (D-033): o brilho passa da esquerda
 * para a direita (`.esqueleto` no globals.css). São decorativos; quem anuncia
 * a espera é o `Carregando`, que só aparece se ela passar de 300 ms.
 */
export function Esqueleto({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`esqueleto block rounded-md ${className}`} />;
}

/** Região de espera: anuncia "Carregando" aos leitores de tela e mostra os esqueletos. */
export function Carregando({
  rotulo = "Carregando",
  children,
}: {
  rotulo?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className="carregamento-atrasado">
      <span className="sr-only">{rotulo}</span>
      {children}
    </div>
  );
}

/** Lista de cartões ou linhas (ex.: leads) enquanto os dados chegam. */
export function EsqueletoDeLista({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie">
      {Array.from({ length: linhas }, (_, indice) => (
        <div key={indice} className="flex items-center gap-4 p-4">
          <div className="flex flex-1 flex-col gap-2">
            <Esqueleto className="h-4 w-2/5" />
            <Esqueleto className="h-3 w-3/5" />
          </div>
          <Esqueleto className="h-6 w-20 rounded-full" />
          <Esqueleto className="hidden h-4 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Blocos de indicadores (ex.: visão geral) enquanto os números chegam. */
export function EsqueletoDeIndicadores({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: quantidade }, (_, indice) => (
        <div
          key={indice}
          className="flex flex-col gap-3 rounded-lg border border-borda bg-superficie p-5"
        >
          <Esqueleto className="h-3 w-1/2" />
          <Esqueleto className="h-8 w-1/3" />
          <Esqueleto className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
