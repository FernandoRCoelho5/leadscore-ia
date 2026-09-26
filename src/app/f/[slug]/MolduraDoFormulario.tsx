import type { ReactNode } from "react";

import { Logo } from "@/components/marca/Logo";

/**
 * Moldura do formulário público: cartão central e, no rodapé, o logo discreto
 * ("feito com Brasa"). O link abre em outra aba para não trocar o conteúdo do
 * iframe no site do cliente.
 */
export function MolduraDoFormulario({
  urlDaBrasa,
  children,
}: {
  urlDaBrasa: string;
  children: ReactNode;
}) {
  return (
    <main
      id="conteudo"
      className="flex flex-1 flex-col items-center gap-6 px-4 py-8 sm:px-6 sm:py-12"
    >
      <div className="w-full max-w-xl rounded-lg border border-borda bg-superficie p-6 shadow-sm sm:p-8">
        {children}
      </div>
      <footer>
        <a
          href={urlDaBrasa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Feito com Brasa (abre em outra aba)"
          className="flex min-h-11 items-center gap-2 rounded-md px-2 text-xs text-texto-suave hover:text-texto"
        >
          feito com
          <Logo decorativo className="h-4 w-auto" />
        </a>
      </footer>
    </main>
  );
}
