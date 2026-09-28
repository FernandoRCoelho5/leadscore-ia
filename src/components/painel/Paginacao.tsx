import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Paginação das listas (D-014): links comuns (funcionam sem JavaScript e
 * podem ser abertos em outra aba), com a página atual marcada por
 * aria-current e o total sempre visível.
 */

const LINK =
  "inline-flex h-controle min-w-controle items-center justify-center gap-1 rounded-md px-3 text-sm";

/** Até 5 números em volta da página atual. */
function paginasVisiveis(atual: number, total: number): number[] {
  const inicio = Math.max(1, Math.min(atual - 2, total - 4));
  const fim = Math.min(total, inicio + 4);
  return Array.from({ length: fim - inicio + 1 }, (_, indice) => inicio + indice);
}

export function Paginacao({
  pagina,
  porPagina,
  total,
  totalPaginas,
  urlDaPagina,
  nomeDosItens,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
  urlDaPagina: (pagina: number) => string;
  /** No plural: "leads", "empresas"... */
  nomeDosItens: string;
}) {
  const primeiro = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const ultimo = Math.min(total, pagina * porPagina);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-texto-suave tabular-nums">
        Mostrando {primeiro.toLocaleString("pt-BR")}–{ultimo.toLocaleString("pt-BR")} de{" "}
        {total.toLocaleString("pt-BR")} {nomeDosItens}
      </p>
      {totalPaginas > 1 && (
        <nav aria-label="Paginação">
          <ul className="flex flex-wrap items-center gap-1">
            <li>
              {pagina > 1 ? (
                <Link href={urlDaPagina(pagina - 1)} className={`${LINK} hover:bg-superficie-2`}>
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  Anterior
                </Link>
              ) : (
                <span aria-disabled="true" className={`${LINK} text-texto-suave opacity-60`}>
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  Anterior
                </span>
              )}
            </li>
            {paginasVisiveis(pagina, totalPaginas).map((numero) => (
              <li key={numero} className="hidden sm:block">
                <Link
                  href={urlDaPagina(numero)}
                  aria-current={numero === pagina ? "page" : undefined}
                  aria-label={`Página ${numero}`}
                  className={`${LINK} tabular-nums ${
                    numero === pagina
                      ? "bg-superficie-2 font-semibold text-marca-texto"
                      : "hover:bg-superficie-2"
                  }`}
                >
                  {numero}
                </Link>
              </li>
            ))}
            <li>
              {pagina < totalPaginas ? (
                <Link href={urlDaPagina(pagina + 1)} className={`${LINK} hover:bg-superficie-2`}>
                  Próxima
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Link>
              ) : (
                <span aria-disabled="true" className={`${LINK} text-texto-suave opacity-60`}>
                  Próxima
                  <ChevronRight aria-hidden="true" className="size-4" />
                </span>
              )}
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
