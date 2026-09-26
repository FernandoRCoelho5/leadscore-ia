"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { ErroNaoEncontrado, ErroValidacao } from "@/lib/erros";
import { STATUS_DO_LEAD } from "@/lib/rotulos";
import { contextoDa, exigirSessaoComEmpresa, type Sessao } from "@/server/auth/sessao";
import { executarAcao, type ResultadoDeAcao } from "@/server/http/acao";
import { obterMotor } from "@/server/ia";
import { reanalisarLead, type ResultadoDaAnaliseDoLead } from "@/server/services/analise";
import {
  alterarStatusDoLead,
  anonimizarLeadDaEmpresa,
  excluirLeadDaEmpresa,
} from "@/server/services/leads";

/**
 * Ações da tela do lead (D-029). Em todas, a empresa vem da sessão, nunca do
 * navegador (IDOR), e o lead é procurado só dentro dela; a permissão é
 * conferida no serviço (o suporte só lê).
 */

const esquemaDoLead = z.uuid("Lead inválido.");

function validar<Saida>(esquema: z.ZodType<Saida>, valor: unknown): Saida {
  const validacao = esquema.safeParse(valor);
  if (!validacao.success) {
    throw ErroValidacao.deZod(validacao.error);
  }
  return validacao.data;
}

async function empresaDaSessao(): Promise<{ sessao: Sessao; empresaId: string }> {
  const sessao = await exigirSessaoComEmpresa();
  const empresaId = sessao.empresaAtiva?.empresaId;
  if (!empresaId) {
    throw new ErroNaoEncontrado("Lead não encontrado.");
  }
  return { sessao, empresaId };
}

function atualizarTelas(leadId: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/painel");
}

/**
 * Reanalisa um lead. Roda na hora (quem clicou espera o resultado), com o
 * mesmo serviço da análise automática.
 */
export async function reanalisarLeadAcao(
  leadId: unknown,
): Promise<ResultadoDeAcao<ResultadoDaAnaliseDoLead>> {
  return executarAcao(async () => {
    const { sessao, empresaId } = await empresaDaSessao();
    const id = validar(esquemaDoLead, leadId);
    const resultado = await reanalisarLead(db, obterMotor(), contextoDa(sessao), empresaId, id);
    atualizarTelas(id);
    return resultado;
  });
}

export async function alterarStatusAcao(
  leadId: unknown,
  status: unknown,
): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const { sessao, empresaId } = await empresaDaSessao();
    const id = validar(esquemaDoLead, leadId);
    const novo = validar(z.enum(STATUS_DO_LEAD, "Andamento inválido."), status);
    await alterarStatusDoLead(db, contextoDa(sessao), empresaId, id, novo);
    atualizarTelas(id);
    return null;
  });
}

export async function excluirLeadAcao(leadId: unknown): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const { sessao, empresaId } = await empresaDaSessao();
    const id = validar(esquemaDoLead, leadId);
    await excluirLeadDaEmpresa(db, contextoDa(sessao), empresaId, id);
    atualizarTelas(id);
    return null;
  });
}

export async function anonimizarLeadAcao(
  leadId: unknown,
  confirmacao: unknown,
): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const { sessao, empresaId } = await empresaDaSessao();
    const id = validar(esquemaDoLead, leadId);
    const texto = validar(z.string().max(50), confirmacao);
    await anonimizarLeadDaEmpresa(db, contextoDa(sessao), empresaId, id, texto);
    atualizarTelas(id);
    return null;
  });
}
