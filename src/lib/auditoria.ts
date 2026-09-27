/**
 * Catálogo das ações gravadas na auditoria: o identificador que vai para o
 * banco e o texto exibido na tela e no CSV. `registrarAuditoria` só aceita as
 * ações daqui, então uma ação nova não fica sem texto nem fora do filtro.
 * A ordem é a do filtro da tela (agrupado por assunto).
 */
export const ACOES_DA_AUDITORIA = {
  "auth.login": { grupo: "Acesso", rotulo: "Entrou no sistema" },
  "auth.sessao_encerrada": { grupo: "Acesso", rotulo: "Saiu do sistema" },
  "usuario.cadastrado": { grupo: "Contas", rotulo: "Criou a conta" },
  "usuario.perfil_atualizado": { grupo: "Contas", rotulo: "Alterou o próprio nome" },
  "usuario.senha_alterada": { grupo: "Contas", rotulo: "Alterou a senha" },
  "usuario.foto_alterada": { grupo: "Contas", rotulo: "Trocou a foto" },
  "usuario.foto_removida": { grupo: "Contas", rotulo: "Removeu a foto" },
  "usuario.bloqueado": { grupo: "Contas", rotulo: "Bloqueou um usuário" },
  "usuario.desbloqueado": { grupo: "Contas", rotulo: "Desbloqueou um usuário" },
  "empresa.criada": { grupo: "Empresas", rotulo: "Criou a empresa" },
  "empresa.perfil_atualizado": { grupo: "Empresas", rotulo: "Alterou o perfil da empresa" },
  "empresa.acessada": { grupo: "Empresas", rotulo: "Abriu a empresa (equipe Brasa)" },
  "empresa.bloqueada": { grupo: "Empresas", rotulo: "Bloqueou a empresa" },
  "empresa.desbloqueada": { grupo: "Empresas", rotulo: "Desbloqueou a empresa" },
  "empresa.limite_alterado": { grupo: "Empresas", rotulo: "Alterou o limite de análises" },
  "lead.visualizado": { grupo: "Leads", rotulo: "Viu um lead (equipe Brasa)" },
  "lead.status_alterado": { grupo: "Leads", rotulo: "Alterou o andamento de um lead" },
  "lead.reanalisado": { grupo: "Leads", rotulo: "Pediu nova análise de um lead" },
  "lead.excluido": { grupo: "Leads", rotulo: "Excluiu um lead" },
  "lead.anonimizado": { grupo: "Leads", rotulo: "Anonimizou um lead (LGPD)" },
  "leads.exportados": { grupo: "Exportações", rotulo: "Exportou os leads" },
  "empresas.exportadas": { grupo: "Exportações", rotulo: "Exportou a lista de empresas" },
  "usuarios.exportados": { grupo: "Exportações", rotulo: "Exportou a lista de usuários" },
  "auditoria.exportada": { grupo: "Exportações", rotulo: "Exportou a auditoria" },
} as const satisfies Record<string, { grupo: string; rotulo: string }>;

export type AcaoDaAuditoria = keyof typeof ACOES_DA_AUDITORIA;

export const CODIGOS_DAS_ACOES = Object.keys(ACOES_DA_AUDITORIA) as [
  AcaoDaAuditoria,
  ...AcaoDaAuditoria[],
];

/** Texto da ação; um código antigo, fora do catálogo, aparece como foi gravado. */
export function rotuloDaAcao(acao: string): string {
  return Object.hasOwn(ACOES_DA_AUDITORIA, acao)
    ? ACOES_DA_AUDITORIA[acao as AcaoDaAuditoria].rotulo
    : acao;
}

/**
 * Detalhes do evento em texto curto ("de: 100 · para: 200"). A auditoria não
 * guarda dados pessoais nos detalhes, então eles podem ir para a tela e o CSV.
 */
export function resumirDetalhes(detalhes: Record<string, unknown>): string {
  return Object.entries(detalhes)
    .filter(([, valor]) => valor !== undefined && valor !== null && valor !== "")
    .map(
      ([chave, valor]) =>
        `${chave}: ${typeof valor === "object" ? JSON.stringify(valor) : String(valor)}`,
    )
    .join(" · ");
}
