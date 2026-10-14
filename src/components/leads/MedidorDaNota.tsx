import type { CSSProperties } from "react";

import type { Classificacao } from "@/db/schema";
import { ROTULO_DA_CLASSIFICACAO } from "@/lib/rotulos";

import { NumeroAnimado } from "../ui/NumeroAnimado";

/**
 * Nota da IA (0 a 100) como termômetro (D-033): a barra vai do gelo ao âmbar
 * e à brasa (`escala-termica`) e enche ao aparecer. O número e a
 * classificação vêm escritos: a barra é reforço, a informação nunca depende
 * só da cor.
 */
export function MedidorDaNota({
  score,
  classificacao,
}: {
  score: number;
  classificacao: Classificacao;
}) {
  const nota = Math.min(100, Math.max(0, Math.round(score)));
  // O gradiente cobre a escala inteira (0 a 100); a parte cheia mostra só o
  // trecho até a nota, então 30 fica no frio e 90 chega à brasa.
  const preenchimento: CSSProperties = {
    width: `${Math.max(2, nota)}%`,
    backgroundSize: `${(100 / Math.max(2, nota)) * 100}% 100%`,
  };

  return (
    <div className="flex items-center gap-4">
      <p className="text-4xl leading-none font-bold">
        <NumeroAnimado valor={nota} />
        <span className="text-base font-medium text-texto-suave"> / 100</span>
      </p>
      <div
        role="meter"
        aria-label="Nota da IA"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={nota}
        aria-valuetext={`${nota} de 100, ${ROTULO_DA_CLASSIFICACAO[classificacao]}`}
        className="h-3 flex-1 overflow-hidden rounded-full bg-trilho"
      >
        <div
          className="h-full origin-left animate-encher rounded-full bg-(image:--escala-termica) bg-no-repeat"
          style={preenchimento}
        />
      </div>
    </div>
  );
}
