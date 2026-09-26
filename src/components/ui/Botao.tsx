import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

const VARIANTES = {
  primaria: "bg-primaria text-texto-primaria hover:bg-primaria-hover",
  secundaria: "bg-secundaria text-texto-secundaria hover:opacity-90",
  contorno: "border border-borda-campo bg-superficie text-texto hover:bg-superficie-2",
  fantasma: "text-texto hover:bg-superficie-2",
  destrutivo: "bg-destrutivo text-texto-destrutivo hover:opacity-90",
} as const;

type PropsDoBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof VARIANTES;
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
      className={`inline-flex h-controle cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]} ${larguraTotal ? "w-full" : ""} ${className}`}
      {...resto}
    >
      {carregando && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
