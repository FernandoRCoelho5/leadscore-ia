import { CircleDashed, Flame, Snowflake, Thermometer, type LucideIcon } from "lucide-react";

import type { Classificacao } from "@/db/schema";

type Aparencia = { rotulo: string; Icone: LucideIcon; cores: string };

/**
 * Cores da escala térmica (docs/identidade-visual.md, seção 5). O ícone e a
 * palavra sempre acompanham a cor: a classificação nunca depende só da cor
 * (acessível a daltônicos).
 */
const APARENCIAS: Record<Classificacao, Aparencia> = {
  quente: {
    rotulo: "Quente",
    Icone: Flame,
    cores: "bg-quente-fundo text-quente-texto [&>svg]:text-quente-icone",
  },
  morno: {
    rotulo: "Morno",
    Icone: Thermometer,
    cores: "bg-morno-fundo text-morno-texto [&>svg]:text-morno-icone",
  },
  frio: {
    rotulo: "Frio",
    Icone: Snowflake,
    cores: "bg-frio-fundo text-frio-texto [&>svg]:text-frio-icone",
  },
};

const SEM_ANALISE: Aparencia = {
  rotulo: "Sem análise",
  Icone: CircleDashed,
  cores: "bg-superficie-2 text-texto-suave",
};

type PropsDoBadge = {
  /** `null` para leads ainda não analisados. */
  classificacao: Classificacao | null;
  /**
   * Chama viva no quente (D-033). Só em destaques (ex.: o título do lead): numa
   * lista, várias chamas mexendo ao mesmo tempo disputariam a atenção.
   */
  vivo?: boolean;
  className?: string;
};

export function BadgeClassificacao({ classificacao, vivo = false, className = "" }: PropsDoBadge) {
  const { rotulo, Icone, cores } = classificacao ? APARENCIAS[classificacao] : SEM_ANALISE;
  const chama = vivo && classificacao === "quente" ? "origin-[50%_90%] animate-chama" : "";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm leading-none font-medium whitespace-nowrap ${cores} ${className}`}
    >
      <Icone aria-hidden="true" className={`size-3.5 shrink-0 ${chama}`} strokeWidth={2.25} />
      {rotulo}
    </span>
  );
}
