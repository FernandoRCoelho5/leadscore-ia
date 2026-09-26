"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { ErroNaoEncontrado, ErroValidacao } from "@/lib/erros";
import { contextoDa, exigirSessaoComEmpresa } from "@/server/auth/sessao";
import { executarAcao, type ResultadoDeAcao } from "@/server/http/acao";
import { obterMotor } from "@/server/ia";
import { reanalisarLead, type ResultadoDaAnaliseDoLead } from "@/server/services/analise";

const esquemaDoLead = z.uuid("Lead inválido.");

/**
 * Reanalisa um lead da empresa ativa. A empresa vem da sessão, nunca do
 * navegador (IDOR); o lead é procurado só dentro dela. Roda na hora (quem
 * clicou espera o resultado), com o mesmo serviço da análise automática.
 * O botão entra na tela do lead (Etapa 7).
 */
export async function reanalisarLeadAcao(
  leadId: unknown,
): Promise<ResultadoDeAcao<ResultadoDaAnaliseDoLead>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComEmpresa();
    const empresaId = sessao.empresaAtiva?.empresaId;
    if (!empresaId) {
      throw new ErroNaoEncontrado("Lead não encontrado.");
    }
    const validacao = esquemaDoLead.safeParse(leadId);
    if (!validacao.success) {
      throw ErroValidacao.deZod(validacao.error);
    }

    const resultado = await reanalisarLead(
      db,
      obterMotor(),
      contextoDa(sessao),
      empresaId,
      validacao.data,
    );
    revalidatePath("/leads");
    revalidatePath("/painel");
    return resultado;
  });
}
