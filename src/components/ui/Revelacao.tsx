import { ViewTransition, type ReactNode } from "react";

/**
 * Passagem do esqueleto para o conteúdo (React `<ViewTransition>` com
 * Suspense): quando os dados chegam, o esqueleto sai rápido e o conteúdo
 * chega subindo um pouco (`.esqueleto-sai` e `.conteudo-chega` no
 * globals.css). Sem suporte no navegador, o conteúdo só aparece.
 *
 * `default="none"`: nenhuma das duas anima em outras transições (ex.: a
 * página atualizando depois de salvar algo).
 */
export function EsqueletoQueSai({ children }: { children: ReactNode }) {
  return (
    <ViewTransition exit="esqueleto-sai" default="none">
      {children}
    </ViewTransition>
  );
}

/** Envolve o conteúdo da página (no `page.tsx`, não no layout, que não remonta). */
export function ConteudoQueChega({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="conteudo-chega" default="none">
      {children}
    </ViewTransition>
  );
}
