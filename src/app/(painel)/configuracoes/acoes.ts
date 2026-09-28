"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { ErroNaoEncontrado, ErroValidacao } from "@/lib/erros";
import { esquemaPerfilDoNegocio } from "@/lib/validacao/empresa";
import { contextoDa, exigirSessaoComEmpresa } from "@/server/auth/sessao";
import { executarAcao, type ResultadoDeAcao } from "@/server/http/acao";
import { atualizarPerfilDoNegocio } from "@/server/services/empresas";

/**
 * Salva o perfil do negócio da empresa ATIVA (lida da sessão no servidor):
 * o navegador nunca escolhe o ID da empresa, o que impede alterar outra (IDOR).
 */
export async function salvarPerfilDoNegocioAcao(dados: unknown): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComEmpresa();
    if (!sessao.empresaAtiva) {
      throw new ErroNaoEncontrado();
    }
    const validacao = esquemaPerfilDoNegocio.safeParse(dados);
    if (!validacao.success) {
      throw ErroValidacao.deZod(validacao.error);
    }
    await atualizarPerfilDoNegocio(
      db,
      contextoDa(sessao),
      sessao.empresaAtiva.empresaId,
      validacao.data,
    );
    revalidatePath("/configuracoes");
    return null;
  });
}
