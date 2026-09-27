import { Search, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Botao } from "@/components/ui/Botao";

/**
 * Moldura dos filtros das listas: um formulário GET comum. Os filtros ficam na
 * URL, então a lista filtrada pode ser salva nos favoritos, compartilhada e
 * usada pela exportação. Funciona sem JavaScript.
 */
export function FormularioDeFiltros({
  caminho,
  rotulo,
  temFiltro,
  colunas = "lg:grid-cols-4",
  children,
}: {
  caminho: string;
  /** Nome do formulário para leitores de tela ("Filtrar leads"). */
  rotulo: string;
  temFiltro: boolean;
  /** Colunas no computador; os campos e os botões ocupam uma linha inteira. */
  colunas?: "lg:grid-cols-4" | "lg:grid-cols-5";
  children: ReactNode;
}) {
  return (
    <form
      method="get"
      action={caminho}
      role="search"
      aria-label={rotulo}
      className={`mb-4 grid gap-4 rounded-lg border border-borda bg-superficie p-4 sm:grid-cols-2 ${colunas}`}
    >
      {children}
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
        {temFiltro && (
          <Link
            href={caminho}
            className="inline-flex h-controle items-center gap-2 rounded-md px-4 text-sm font-semibold text-texto hover:bg-superficie-2"
          >
            <X aria-hidden="true" className="size-4" />
            Limpar filtros
          </Link>
        )}
        <Botao type="submit" variante="primaria">
          <Search aria-hidden="true" className="size-4" />
          Filtrar
        </Botao>
      </div>
    </form>
  );
}
