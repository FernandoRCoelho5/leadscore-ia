import { ErroNaoEncontrado, ErroProibido } from "@/lib/erros";

/**
 * Matriz de permissões (RBAC), conforme docs/arquitetura.md, seção 4.
 *
 * - admin e suporte são da equipe do SaaS e atuam em todas as empresas;
 *   o suporte só lê.
 * - cliente atua apenas nas empresas das quais é membro.
 *
 * Verificada no servidor (serviços, actions e páginas). A interface usa a mesma
 * matriz só para esconder o que o perfil não pode usar.
 */

export const PAPEIS = ["admin", "suporte", "cliente"] as const;
export type Papel = (typeof PAPEIS)[number];

export const ACOES = [
  "painel:ver",
  "leads:ver",
  "leads:editar",
  "leads:exportar",
  "empresa:ver",
  "empresa:editar",
  "empresa:administrar",
  "empresas:listar",
  "usuarios:listar",
  "membros:ver",
  "membros:gerir",
  "plataforma:gerir-usuarios",
  "auditoria:ver",
  "perfil:editar",
] as const;
export type Acao = (typeof ACOES)[number];

const PERMISSOES: Record<Papel, ReadonlySet<Acao>> = {
  admin: new Set(ACOES),
  suporte: new Set<Acao>([
    "painel:ver",
    "leads:ver",
    "empresa:ver",
    "empresas:listar",
    "usuarios:listar",
    "membros:ver",
    "auditoria:ver",
    "perfil:editar",
  ]),
  cliente: new Set<Acao>([
    "painel:ver",
    "leads:ver",
    "leads:editar",
    "leads:exportar",
    "empresa:ver",
    "empresa:editar",
    "membros:ver",
    "membros:gerir",
    "perfil:editar",
  ]),
};

/** Quem está agindo: o papel e as empresas das quais é membro. */
export type Ator = {
  papel: Papel;
  empresaIds: readonly string[];
};

/**
 * O ator pode executar a ação? Se `empresaId` for informado, também confere o
 * escopo: o cliente só atua nas empresas dele; admin e suporte, em todas.
 */
export function pode(ator: Ator, acao: Acao, empresaId?: string): boolean {
  if (!PERMISSOES[ator.papel].has(acao)) {
    return false;
  }
  if (empresaId === undefined || ator.papel !== "cliente") {
    return true;
  }
  return ator.empresaIds.includes(empresaId);
}

/**
 * Como `pode`, mas lança o erro adequado. Empresa fora do escopo responde
 * "não encontrado" (404), para não revelar que ela existe.
 */
export function autorizar(ator: Ator, acao: Acao, empresaId?: string): void {
  if (!PERMISSOES[ator.papel].has(acao)) {
    throw new ErroProibido();
  }
  if (!pode(ator, acao, empresaId)) {
    throw new ErroNaoEncontrado();
  }
}
