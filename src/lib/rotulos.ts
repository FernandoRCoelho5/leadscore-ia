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

/** Palavra digitada para confirmar a anonimização (LGPD), ação irreversível. */
export const PALAVRA_PARA_ANONIMIZAR = "ANONIMIZAR";

export const SITUACOES_DA_EMPRESA = ["ativa", "bloqueada"] as const;
export type SituacaoDaEmpresa = (typeof SITUACOES_DA_EMPRESA)[number];

export const ROTULO_DA_SITUACAO_DA_EMPRESA: Record<SituacaoDaEmpresa, string> = {
  ativa: "Ativa",
  bloqueada: "Bloqueada",
};

export const SITUACOES_DO_USUARIO = ["ativo", "bloqueado"] as const;
export type SituacaoDoUsuario = (typeof SITUACOES_DO_USUARIO)[number];

export const ROTULO_DA_SITUACAO_DO_USUARIO: Record<SituacaoDoUsuario, string> = {
  ativo: "Ativo",
  bloqueado: "Bloqueado",
};

/** Perfis de acesso (RBAC), na ordem dos filtros. */
export const PAPEIS_DE_ACESSO = ["admin", "suporte", "cliente"] as const;
export type PapelDeAcesso = (typeof PAPEIS_DE_ACESSO)[number];

export const ROTULO_DO_PAPEL: Record<PapelDeAcesso, string> = {
  admin: "Admin",
  suporte: "Suporte",
  cliente: "Cliente",
};
