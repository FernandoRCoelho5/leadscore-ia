import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

const VARIANTES = {
  primaria: "bg-primaria text-texto-primaria hover:bg-primaria-hover",
  secundaria: "bg-secundaria text-texto-secundaria hover:opacity-90",
  contorno: "border border-borda-campo bg-superficie text-texto hover:bg-superficie-2",
  fantasma: "text-texto hover:bg-superficie-2",
  destrutivo: "bg-destrutivo text-texto-destrutivo hover:opacity-90",
} as const;

type Variante = keyof typeof VARIANTES;

/** Classes do botão, para elementos que precisam parecer botão (ex.: rótulo do envio de arquivo). */
export function classesDeBotao(variante: Variante = "primaria"): string {
  return `inline-flex h-controle cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]}`;
}

type PropsDoBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  /** Mostra o indicador de carregamento e bloqueia novos cliques. */
  carregando?: boolean;
  larguraTotal?: boolean;
};

/** Botão padrão da Brasa (altura de controle: 40px, ou 44px em telas de toque). */
export function Botao({
  variante = "primaria",
  carregando = false,
  larguraTotal = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...resto
}: PropsDoBotao) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`${classesDeBotao(variante)} ${larguraTotal ? "w-full" : ""} ${className}`}
      {...resto}
    >
      {carregando && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
