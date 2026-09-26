import "server-only";

import type { Lead } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { inicioDoMes } from "@/lib/datas";
import { ErroNaoEncontrado } from "@/lib/erros";
import { autorizar } from "@/server/auth/permissoes";
import { obterEmpresa } from "@/server/repositories/empresas";
import { listarLeads, resumirLeads, type ResumoDosLeads } from "@/server/repositories/leads";
import { resumirPlataforma, type ResumoDaPlataforma } from "@/server/repositories/plataforma";
import { competenciaDe, obterUsoDoMes } from "@/server/repositories/usoMensal";

import type { ContextoDoUsuario } from "./contexto";

/** Números da visão geral (D-029), sempre do mês corrente no fuso de São Paulo. */

export type VisaoGeralDaEmpresa = {
  leads: ResumoDosLeads;
  analisesUsadas: number;
  limiteDeAnalises: number;
  /** Os leads quentes mais recentes, para agir primeiro. */
  quentesRecentes: Lead[];
};

export async function visaoGeralDaEmpresa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  agora: Date = new Date(),
): Promise<VisaoGeralDaEmpresa> {
  autorizar(contexto.ator, "painel:ver", empresaId);
  autorizar(contexto.ator, "leads:ver", empresaId);
  const empresa = await obterEmpresa(db, empresaId);
  if (!empresa) {
    throw new ErroNaoEncontrado("Empresa não encontrada.");
  }
  const [leads, uso, quentes] = await Promise.all([
    resumirLeads(db, empresaId, inicioDoMes(agora)),
    obterUsoDoMes(db, empresaId, competenciaDe(agora)),
    listarLeads(db, empresaId, { classificacao: "quente" }, { porPagina: 5 }),
  ]);
  return {
    leads,
    analisesUsadas: uso?.analises ?? 0,
    limiteDeAnalises: empresa.limiteAnalisesMes,
    quentesRecentes: quentes.itens,
  };
}

/** Visão da plataforma inteira: só para a equipe Brasa (quem lista empresas). */
export async function visaoGeralDaPlataforma(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  agora: Date = new Date(),
): Promise<ResumoDaPlataforma> {
  autorizar(contexto.ator, "empresas:listar");
  return resumirPlataforma(db, inicioDoMes(agora), competenciaDe(agora));
}
