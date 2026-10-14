import { useId, type ReactNode } from "react";

/**
 * Cartão padrão da área logada: superfície, borda de 1px e sombra mínima
 * (D-033). Com título, vira uma região nomeada (`<section>` ligada ao `<h2>`).
 * `quente` dá o brilho que respira, reservado ao que é urgente (ex.: lead
 * quente): só a opacidade de uma camada já pintada muda.
 */
export function Cartao({
  titulo,
  descricao,
  acao,
  quente = false,
  className = "",
  children,
}: {
  titulo?: string;
  descricao?: ReactNode;
  /** Ação no canto do cabeçalho (ex.: "Ver todos"). */
  acao?: ReactNode;
  quente?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const idDoTitulo = useId();
  const Elemento = titulo ? "section" : "div";

  return (
    <Elemento
      aria-labelledby={titulo ? idDoTitulo : undefined}
      className={`relative isolate rounded-lg border border-borda bg-superficie p-5 shadow-sm sm:p-6 ${className}`}
    >
      {quente && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px -z-10 animate-respirar rounded-[inherit] shadow-brilho-quente"
        />
      )}
      {titulo && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 id={idDoTitulo} className="text-lg font-semibold">
              {titulo}
            </h2>
            {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
          </div>
          {acao}
        </div>
      )}
      {children}
    </Elemento>
  );
}
