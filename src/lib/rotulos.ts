import type { Classificacao, StatusAnalise, StatusLead } from "@/db/schema";

/** Textos exibidos para os valores guardados no banco (uma fonte só para telas e CSV). */

export const STATUS_DO_LEAD = [
  "novo",
  "em_contato",
  "ganho",
  "perdido",
] as const satisfies readonly StatusLead[];

export const ROTULO_DO_STATUS: Record<StatusLead, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const CLASSIFICACOES = [
  "quente",
  "morno",
  "frio",
] as const satisfies readonly Classificacao[];

export const ROTULO_DA_CLASSIFICACAO: Record<Classificacao, string> = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
};

export const ROTULO_DA_ANALISE: Record<StatusAnalise, string> = {
  pendente: "Aguardando análise",
  processando: "Em análise",
  concluida: "Analisado",
  falhou: "A análise falhou",
  limite_atingido: "Limite do mês atingido",
};

export const ROTULO_DA_ORIGEM = {
  formulario: "Formulário do site",
  manual: "Cadastro manual",
} as const;
