import "server-only";

import type { Analise, Lead, StatusLead } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { ErroConflito, ErroNaoEncontrado, ErroValidacao } from "@/lib/erros";
import type { Pagina, Paginacao } from "@/lib/paginacao";
import { autorizar } from "@/server/auth/permissoes";
import { listarAnalisesDoLead } from "@/server/repositories/analises";
import { registrarAuditoria } from "@/server/repositories/auditoria";
import {
  anonimizarLead,
  atualizarStatusDoLead,
  excluirLead,
  listarLeads,
  lotesDeLeadsParaExportar,
  obterLead,
  type FiltrosDeLeads,
} from "@/server/repositories/leads";

import type { ContextoDoUsuario } from "./contexto";

/**
 * Casos de uso dos leads no painel (D-029). Todo acesso passa pelo RBAC com o
 * escopo da empresa: o cliente só atua nas empresas dele, e o suporte só lê.
 * A auditoria nunca guarda dados pessoais (nome, e-mail, telefone, busca).
 */

/** Admin e suporte são da equipe Brasa: o acesso deles a dados de clientes é auditado. */
const ehDaEquipe = (contexto: ContextoDoUsuario) => contexto.ator.papel !== "cliente";

export async function listarLeadsDaEmpresa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  filtros: FiltrosDeLeads,
  paginacao: Partial<Paginacao>,
): Promise<Pagina<Lead>> {
  autorizar(contexto.ator, "leads:ver", empresaId);
  return listarLeads(db, empresaId, filtros, paginacao);
}

export type DetalheDoLead = { lead: Lead; analises: Analise[] };

export async function obterDetalheDoLead(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  leadId: string,
): Promise<DetalheDoLead> {
  autorizar(contexto.ator, "leads:ver", empresaId);
  const lead = await obterLead(db, empresaId, leadId);
  if (!lead) {
    throw new ErroNaoEncontrado("Lead não encontrado.");
  }
  const analises = await listarAnalisesDoLead(db, empresaId, leadId);
  if (ehDaEquipe(contexto)) {
    await registrarAuditoria(db, {
      atorId: contexto.usuarioId,
      empresaId,
      acao: "lead.visualizado",
      recursoTipo: "lead",
      recursoId: leadId,
    });
  }
  return { lead, analises };
}

export async function alterarStatusDoLead(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  leadId: string,
  status: StatusLead,
): Promise<Lead> {
  autorizar(contexto.ator, "leads:editar", empresaId);
  return db.transaction(async (tx) => {
    const anterior = await obterLead(tx, empresaId, leadId);
    if (!anterior) {
      throw new ErroNaoEncontrado("Lead não encontrado.");
    }
    const lead = await atualizarStatusDoLead(tx, empresaId, leadId, status);
    if (!lead) {
      throw new ErroNaoEncontrado("Lead não encontrado.");
    }
    if (anterior.status !== status) {
      await registrarAuditoria(tx, {
        atorId: contexto.usuarioId,
        empresaId,
        acao: "lead.status_alterado",
        recursoTipo: "lead",
        recursoId: leadId,
        detalhes: { de: anterior.status, para: status },
      });
    }
    return lead;
  });
}

/** Exclusão lógica: o lead some das listas, mas o registro continua no banco. */
export async function excluirLeadDaEmpresa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  leadId: string,
): Promise<void> {
  autorizar(contexto.ator, "leads:editar", empresaId);
  await db.transaction(async (tx) => {
    if (!(await excluirLead(tx, empresaId, leadId))) {
      throw new ErroNaoEncontrado("Lead não encontrado.");
    }
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId,
      acao: "lead.excluido",
      recursoTipo: "lead",
      recursoId: leadId,
    });
  });
}

/** Palavra que a pessoa digita para confirmar a anonimização (ação irreversível). */
export const CONFIRMACAO_DA_ANONIMIZACAO = "ANONIMIZAR";

/** Atende a um pedido de eliminação de dados do titular (LGPD, D-012). */
export async function anonimizarLeadDaEmpresa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  leadId: string,
  confirmacao: string,
): Promise<void> {
  autorizar(contexto.ator, "leads:editar", empresaId);
  if (confirmacao.trim().toUpperCase() !== CONFIRMACAO_DA_ANONIMIZACAO) {
    throw new ErroValidacao(
      [
        {
          campo: "confirmacao",
          mensagem: `Digite ${CONFIRMACAO_DA_ANONIMIZACAO} para confirmar.`,
        },
      ],
      "A anonimização não foi confirmada.",
    );
  }
  const lead = await obterLead(db, empresaId, leadId);
  if (!lead) {
    throw new ErroNaoEncontrado("Lead não encontrado.");
  }
  if (lead.anonimizadoEm) {
    throw new ErroConflito("Este lead já foi anonimizado.");
  }
  await db.transaction(async (tx) => {
    if (!(await anonimizarLead(tx, empresaId, leadId))) {
      throw new ErroConflito("Este lead já foi anonimizado.");
    }
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId,
      acao: "lead.anonimizado",
      recursoTipo: "lead",
      recursoId: leadId,
    });
  });
}

/**
 * Prepara a exportação em CSV: confere a permissão, registra na auditoria
 * (quais filtros, sem o texto da busca, que pode ser um nome ou e-mail) e
 * devolve os lotes para a rota transmitir aos poucos.
 */
export async function exportarLeadsDaEmpresa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  filtros: FiltrosDeLeads,
): Promise<AsyncGenerator<Lead[]>> {
  autorizar(contexto.ator, "leads:exportar", empresaId);
  await registrarAuditoria(db, {
    atorId: contexto.usuarioId,
    empresaId,
    acao: "leads.exportados",
    recursoTipo: "lead",
    recursoId: null,
    detalhes: {
      comBusca: Boolean(filtros.busca),
      classificacao: filtros.classificacao ?? null,
      status: filtros.status ?? null,
      de: filtros.criadoDe?.toISOString() ?? null,
      ate: filtros.criadoAte?.toISOString() ?? null,
    },
  });
  return lotesDeLeadsParaExportar(db, empresaId, filtros);
}
