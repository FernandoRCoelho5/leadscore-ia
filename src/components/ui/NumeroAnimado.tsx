import type { CSSProperties } from "react";

/**
 * Número que conta de 0 até o valor ao aparecer (`--mov-narrativo`), só com
 * CSS (`.numero-animado` no globals.css): funciona em Server Components, não
 * envia JavaScript e não atrasa a página. Com movimento reduzido, o valor
 * aparece direto.
 *
 * O número visível fica num contador de CSS, oculto para leitores de tela; o
 * valor real vai em texto ao lado (sr-only). Valores fora de 0 a 999 ou com
 * casas decimais aparecem formatados, sem animação (o contador de CSS não
 * põe o ponto de milhar).
 */
export function NumeroAnimado({ valor, className = "" }: { valor: number; className?: string }) {
  if (!Number.isInteger(valor) || valor < 0 || valor > 999) {
    return <span className={`tabular-nums ${className}`}>{valor.toLocaleString("pt-BR")}</span>;
  }
  return (
    <span className={`tabular-nums ${className}`}>
      <span
        aria-hidden="true"
        className="numero-animado"
        style={{ "--valor": valor } as CSSProperties}
      />
      <span className="sr-only">{valor}</span>
    </span>
  );
}
