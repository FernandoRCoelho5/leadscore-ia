import type { Classificacao } from "@/db/schema";

/**
 * Nota da IA (0 a 100) como medidor: o número vem escrito (a informação
 * nunca depende só da cor) e a barra usa a cor térmica da classificação
 * (`*-grafico`). O âmbar do morno ganha contorno escuro, porque sozinho não
 * tem contraste suficiente com o fundo (D-029).
 */

const PREENCHIMENTO: Record<Classificacao, string> = {
  quente: "bg-quente-grafico",
  morno: "bg-morno-grafico ring-1 ring-inset ring-morno-grafico-contorno",
  frio: "bg-frio-grafico",
};

export function MedidorDaNota({
  score,
  classificacao,
}: {
  score: number;
  classificacao: Classificacao;
}) {
  return (
    <div className="flex items-center gap-4">
      <p className="text-4xl leading-none font-bold tabular-nums">
        {score}
        <span className="text-base font-medium text-texto-suave"> / 100</span>
      </p>
      <div
        role="meter"
        aria-label="Nota da IA"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="h-3 flex-1 overflow-hidden rounded-full bg-superficie-2"
      >
        <div
          className={`h-full rounded-r ${PREENCHIMENTO[classificacao]}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
    </div>
  );
}
