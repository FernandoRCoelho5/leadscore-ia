import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

const VARIANTES = {
  // Brilho quente no hover: uma camada já pintada que só muda de opacidade.
  primaria:
    "bg-primaria text-texto-primaria hover:bg-primaria-hover after:absolute after:inset-0 after:-z-10 after:rounded-[inherit] after:opacity-0 after:shadow-brilho-quente after:transition-opacity after:duration-(--mov-padrao) hover:after:opacity-100 disabled:after:hidden",
  secundaria: "bg-secundaria text-texto-secundaria hover:opacity-90",
  contorno: "border border-borda-campo bg-superficie text-texto hover:bg-superficie-2",
  fantasma: "text-texto hover:bg-superficie-2",
  destrutivo: "bg-destrutivo text-texto-destrutivo hover:opacity-90",
} as const;

type Variante = keyof typeof VARIANTES;

/**
 * Classes do botão, para elementos que precisam parecer botão (ex.: rótulo do
 * envio de arquivo). `compacto`: menos espaço nas laterais, para as linhas das
 * tabelas (a altura, que é a área de toque, não muda).
 */
export function classesDeBotao(variante: Variante = "primaria", compacto = false): string {
  // Ao clicar, o botão "afunda" (escala 0,97) em --mov-imediato.
  return `relative isolate inline-flex h-controle cursor-pointer items-center justify-center gap-2 rounded-md ${compacto ? "px-3" : "px-4"} text-sm font-semibold transition-[background-color,color,opacity,transform] active:scale-[0.97] active:duration-(--mov-imediato) disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${VARIANTES[variante]}`;
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
      {carregando && <LoaderCircle aria-hidden="true" className="size-4 animate-girar" />}
      {children}
    </button>
  );
}
