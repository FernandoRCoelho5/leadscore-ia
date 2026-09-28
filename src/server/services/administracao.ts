import "server-only";

import type { Empresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { inicioDoMes } from "@/lib/datas";
import type { PapelDeAcesso } from "@/lib/rotulos";
import { ErroConflito, ErroNaoEncontrado, ErroProibido, ErroValidacao } from "@/lib/erros";
import { TAMANHO_MAXIMO_PAGINA, type Pagina, type Paginacao } from "@/lib/paginacao";
import { autorizar } from "@/server/auth/permissoes";
import {
  listarAuditoria,
  lotesDaAuditoriaParaExportar,
  registrarAuditoria,
  type EventoNaLista,
  type FiltrosDaAuditoria,
} from "@/server/repositories/auditoria";
import {
  alterarLimiteDaEmpresa,
  alterarSituacaoDaEmpresa,
  listarEmpresas,
  obterEmpresa,
  type EmpresaNaLista,
  type FiltrosDeEmpresas,
} from "@/server/repositories/empresas";
import { competenciaDe } from "@/server/repositories/usoMensal";
import {
  alterarBloqueioDoUsuario,
  alterarPapelDoUsuario,
  listarUsuarios,
  obterUsuarioAtivo,
  travarAdminsAtivos,
  type FiltrosDeUsuarios,
  type UsuarioNaLista,
} from "@/server/repositories/usuarios";

import type { ContextoDoUsuario } from "./contexto";

/**
 * Administração da plataforma (D-029): só a equipe Brasa. O suporte lista e
 * consulta; alterar (bloquear, mudar limite) é só do admin. Cada alteração vai
 * para a auditoria.
 */

/**
 * A equipe abre uma empresa para ver os leads e o perfil dela (acesso
 * auditado, como pede a matriz RBAC). Quem chama grava a empresa em foco.
 */
export async function abrirEmpresaParaEquipe(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
): Promise<Empresa> {
  if (contexto.ator.papel === "cliente") {
    throw new ErroProibido();
  }
  autorizar(contexto.ator, "empresas:listar");
  const empresa = await obterEmpresa(db, empresaId);
  if (!empresa) {
    throw new ErroNaoEncontrado("Empresa não encontrada.");
  }
  await registrarAuditoria(db, {
    atorId: contexto.usuarioId,
    empresaId,
    acao: "empresa.acessada",
    recursoTipo: "empresa",
    recursoId: empresaId,
  });
  return empresa;
}

export async function listarEmpresasDaPlataforma(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  filtros: FiltrosDeEmpresas,
  paginacao: Partial<Paginacao>,
  agora: Date = new Date(),
): Promise<Pagina<EmpresaNaLista>> {
  autorizar(contexto.ator, "empresas:listar");
  return listarEmpresas(db, filtros, paginacao, inicioDoMes(agora), competenciaDe(agora));
}

export async function alterarSituacaoDaEmpresaNaPlataforma(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  situacao: "ativa" | "bloqueada",
): Promise<void> {
  autorizar(contexto.ator, "empresa:administrar");
  await db.transaction(async (tx) => {
    const empresa = await alterarSituacaoDaEmpresa(tx, empresaId, situacao);
    if (!empresa) {
      throw new ErroNaoEncontrado("Empresa não encontrada.");
    }
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId,
      acao: situacao === "bloqueada" ? "empresa.bloqueada" : "empresa.desbloqueada",
      recursoTipo: "empresa",
      recursoId: empresaId,
    });
  });
}

export const LIMITE_MAXIMO_DE_ANALISES = 100_000;

export async function alterarLimiteDeAnalises(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  limite: number,
): Promise<void> {
  autorizar(contexto.ator, "empresa:administrar");
  if (!Number.isInteger(limite) || limite < 0 || limite > LIMITE_MAXIMO_DE_ANALISES) {
    throw new ErroValidacao(
      [
        {
          campo: "limite",
          mensagem: `Use um número inteiro de 0 a ${LIMITE_MAXIMO_DE_ANALISES.toLocaleString("pt-BR")}.`,
        },
      ],
      "Limite inválido.",
    );
  }
  await db.transaction(async (tx) => {
    const anterior = await obterEmpresa(tx, empresaId);
    if (!anterior) {
      throw new ErroNaoEncontrado("Empresa não encontrada.");
    }
    await alterarLimiteDaEmpresa(tx, empresaId, limite);
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId,
      acao: "empresa.limite_alterado",
      recursoTipo: "empresa",
      recursoId: empresaId,
      detalhes: { de: anterior.limiteAnalisesMes, para: limite },
    });
  });
}

export async function listarUsuariosDaPlataforma(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  filtros: FiltrosDeUsuarios,
  paginacao: Partial<Paginacao>,
): Promise<Pagina<UsuarioNaLista>> {
  autorizar(contexto.ator, "usuarios:listar");
  return listarUsuarios(db, filtros, paginacao);
}

export async function alterarBloqueioNaPlataforma(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  usuarioId: string,
  bloquear: boolean,
): Promise<void> {
  autorizar(contexto.ator, "plataforma:gerir-usuarios");
  if (usuarioId === contexto.usuarioId) {
    throw new ErroConflito("Você não pode bloquear a própria conta.");
  }
  await db.transaction(async (tx) => {
    if (bloquear) {
      await garantirOutroAdmin(tx, usuarioId);
    }
    if (!(await alterarBloqueioDoUsuario(tx, usuarioId, bloquear))) {
      throw new ErroNaoEncontrado("Usuário não encontrado.");
    }
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId: null,
      acao: bloquear ? "usuario.bloqueado" : "usuario.desbloqueado",
      recursoTipo: "usuario",
      recursoId: usuarioId,
    });
  });
}

/**
 * Se o alvo é admin ativo, exige outro admin ativo além dele. Trava as contas
 * de admin até o fim da transação (ver `travarAdminsAtivos`).
 */
async function garantirOutroAdmin(tx: BancoDeDados, alvoId: string): Promise<void> {
  const admins = await travarAdminsAtivos(tx);
  if (admins.includes(alvoId) && admins.length <= 1) {
    throw new ErroConflito("A plataforma precisa de pelo menos um admin ativo.");
  }
}

/**
 * Muda o perfil de acesso de uma conta que já existe (a pessoa se cadastra e o
 * admin a promove). Ninguém muda o próprio perfil, e a plataforma nunca fica
 * sem admin ativo.
 */
export async function alterarPapelNaPlataforma(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  usuarioId: string,
  papel: PapelDeAcesso,
): Promise<void> {
  autorizar(contexto.ator, "plataforma:gerir-usuarios");
  if (usuarioId === contexto.usuarioId) {
    throw new ErroConflito("Você não pode alterar o próprio perfil de acesso.");
  }
  await db.transaction(async (tx) => {
    const alvo = await obterUsuarioAtivo(tx, usuarioId);
    if (!alvo) {
      throw new ErroNaoEncontrado("Usuário não encontrado.");
    }
    const anterior: PapelDeAcesso = alvo.papelPlataforma ?? "cliente";
    if (anterior === papel) {
      return;
    }
    if (anterior === "admin") {
      await garantirOutroAdmin(tx, usuarioId);
    }
    await alterarPapelDoUsuario(tx, usuarioId, papel === "cliente" ? null : papel);
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId: null,
      acao: "usuario.papel_alterado",
      recursoTipo: "usuario",
      recursoId: usuarioId,
      detalhes: { de: anterior, para: papel },
    });
  });
}

export async function consultarAuditoria(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  filtros: FiltrosDaAuditoria,
  paginacao: Partial<Paginacao>,
): Promise<Pagina<EventoNaLista>> {
  autorizar(contexto.ator, "auditoria:ver");
  return listarAuditoria(db, filtros, paginacao);
}

/** O que cada lista exporta. Quem exporta fica registrado na auditoria. */
export type ListaExportavel = "empresas" | "usuarios" | "auditoria";

const EXPORTACAO = {
  empresas: { permissao: "empresas:listar", acao: "empresas.exportadas" },
  usuarios: { permissao: "usuarios:listar", acao: "usuarios.exportados" },
  auditoria: { permissao: "auditoria:ver", acao: "auditoria.exportada" },
} as const;

/** Registra a exportação de uma lista da administração (sem o texto da busca). */
export async function registrarExportacaoDaAdministracao(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  lista: ListaExportavel,
  detalhes: Record<string, unknown>,
): Promise<void> {
  autorizar(contexto.ator, EXPORTACAO[lista].permissao);
  await registrarAuditoria(db, {
    atorId: contexto.usuarioId,
    empresaId: null,
    acao: EXPORTACAO[lista].acao,
    recursoTipo: lista,
    recursoId: null,
    detalhes,
  });
}

/**
 * Exporta a auditoria com os filtros da tela. A própria exportação vira um
 * evento, antes de o arquivo começar a ser gerado.
 */
export async function exportarAuditoria(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  filtros: FiltrosDaAuditoria,
): Promise<AsyncGenerator<EventoNaLista[]>> {
  await registrarExportacaoDaAdministracao(db, contexto, "auditoria", {
    acao: filtros.acao ?? null,
    de: filtros.desde?.toISOString() ?? null,
    ate: filtros.ate?.toISOString() ?? null,
  });
  return lotesDaAuditoriaParaExportar(db, filtros);
}

/**
 * Percorre todas as páginas de uma lista (para o CSV). As listas de empresas
 * e de usuários são pequenas (centenas de linhas); as que crescem sem limite,
 * leads e auditoria, usam cursor (ver `lotesDeLeadsParaExportar`).
 */
export async function* todasAsPaginas<Item>(
  buscarPagina: (paginacao: Paginacao) => Promise<Pagina<Item>>,
): AsyncGenerator<Item[]> {
  for (let pagina = 1; ; pagina += 1) {
    const resultado = await buscarPagina({ pagina, porPagina: TAMANHO_MAXIMO_PAGINA });
    if (resultado.itens.length > 0) {
      yield resultado.itens;
    }
    if (pagina >= resultado.totalPaginas) {
      return;
    }
  }
}
