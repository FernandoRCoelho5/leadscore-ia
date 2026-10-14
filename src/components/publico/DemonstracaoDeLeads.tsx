import type { CSSProperties } from "react";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { NumeroAnimado } from "@/components/ui/NumeroAnimado";
import type { Classificacao } from "@/db/schema";

type LeadDeExemplo = {
  nome: string;
  empresa: string;
  quando: string;
  classificacao: Classificacao;
  nota: number;
};

const LEADS: LeadDeExemplo[] = [
  {
    nome: "Juliana Castro",
    empresa: "Distribuidora Vale Sul",
    quando: "agora",
    classificacao: "quente",
    nota: 88,
  },
  {
    nome: "Bruno Tavares",
    empresa: "Clínica OdontoVida",
    quando: "há 12 min",
    classificacao: "morno",
    nota: 64,
  },
  {
    nome: "Ana Beatriz Souza",
    empresa: "Estudante",
    quando: "há 1 h",
    classificacao: "frio",
    nota: 18,
  },
];

/**
 * Leads de exemplo chegando com a nota da IA, na abertura da landing. Entram
 * em sequência e o número conta (só CSS). Nomes fictícios, marcados como
 * exemplo para leitores de tela.
 */
export function DemonstracaoDeLeads() {
  return (
    <ul aria-label="Exemplo: leads chegando com a nota da IA" className="flex flex-col gap-3">
      {LEADS.map((lead, indice) => {
        const quente = lead.classificacao === "quente";
        return (
          <li
            key={lead.nome}
            style={{ "--i": indice + 2 } as CSSProperties}
            className="escalonado relative isolate animate-entrar rounded-lg border border-borda bg-superficie p-4 shadow-lg"
          >
            {quente && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-px -z-10 animate-respirar rounded-[inherit] shadow-brilho-quente"
              />
            )}
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{lead.nome}</p>
                <p className="truncate text-sm text-texto-suave">
                  {lead.empresa} · {lead.quando}
                </p>
              </div>
              <BadgeClassificacao classificacao={lead.classificacao} vivo={quente} />
              <span className="w-8 text-right text-lg font-bold">
                <NumeroAnimado valor={lead.nota} />
                <span className="sr-only"> de 100</span>
              </span>
            </div>
            <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-trilho">
              <div
                className="h-full origin-left animate-encher rounded-full bg-(image:--escala-termica) bg-no-repeat"
                style={{
                  width: `${lead.nota}%`,
                  backgroundSize: `${(100 / lead.nota) * 100}% 100%`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
