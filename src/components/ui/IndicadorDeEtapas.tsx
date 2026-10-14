import { Check } from "lucide-react";

/**
 * Progresso de um fluxo em passos (ex.: onboarding). O passo atual tem
 * `aria-current="step"`, os concluídos levam o ícone e a palavra "concluído"
 * para leitores de tela: nada depende só da cor. A barra entre os passos
 * enche com `transform` quando um passo termina.
 */
export function IndicadorDeEtapas({
  etapas,
  atual,
}: {
  etapas: readonly string[];
  /** Índice do passo atual, a partir de 0. */
  atual: number;
}) {
  return (
    <ol aria-label="Progresso" className="flex items-start">
      {etapas.map((etapa, indice) => {
        const concluida = indice < atual;
        const ativa = indice === atual;
        return (
          <li
            key={etapa}
            aria-current={ativa ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-2 text-center"
          >
            {indice > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-4 right-1/2 -z-10 h-0.5 w-full overflow-hidden bg-trilho"
              >
                <span
                  className={`block h-full origin-left bg-primaria transition-transform duration-(--mov-enfatico) ease-entrada ${
                    indice <= atual ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </span>
            )}
            <span
              className={`flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                concluida
                  ? "border-primaria bg-primaria text-texto-primaria"
                  : ativa
                    ? "border-primaria bg-superficie text-marca-texto"
                    : "border-borda-campo bg-superficie text-texto-suave"
              }`}
            >
              {concluida ? <Check aria-hidden="true" className="size-4" /> : indice + 1}
            </span>
            <span
              className={`text-xs sm:text-sm ${ativa ? "font-semibold text-texto" : "text-texto-suave"}`}
            >
              {etapa}
              {concluida && <span className="sr-only"> (concluído)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
