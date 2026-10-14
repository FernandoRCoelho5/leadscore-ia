import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Tabela padrão das listas (no computador; no celular, as listas usam
 * cartões). `table-fixed`: colunas de largura previsível recebem `w-*` e a
 * principal fica com o resto, truncada, sem rolagem lateral (D-029).
 */
export function Tabela({
  legenda,
  cabecalho,
  children,
  className = "",
}: {
  /** Nome da tabela para leitores de tela (<caption>). */
  legenda: string;
  /** Linha de títulos: use `Th`. */
  cabecalho: ReactNode;
  /** Linhas: use `Linha` e `Td`. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border border-borda bg-superficie ${className}`}>
      <table className="w-full table-fixed text-left text-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead className="border-b border-borda bg-superficie-2 text-texto-suave">
          <tr>{cabecalho}</tr>
        </thead>
        <tbody className="divide-y divide-borda">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ className = "", ...resto }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={`px-4 py-3 font-medium ${className}`} {...resto} />;
}

export function Td({ className = "", ...resto }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 ${className}`} {...resto} />;
}

/** Linha com destaque suave ao passar o mouse. */
export function Linha({ className = "", children }: { className?: string; children: ReactNode }) {
  return <tr className={`transition-colors hover:bg-superficie-2 ${className}`}>{children}</tr>;
}
