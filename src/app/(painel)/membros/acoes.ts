"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { contextoDa, exigirEmpresaAtiva } from "@/server/auth/sessao";
import { enviarEmail } from "@/server/email/enviador";
import { executarAcao, validarEntrada, type ResultadoDeAcao } from "@/server/http/acao";
import {
  cancelarConviteDaEmpresa,
  convidarPessoa,
  removerMembroDaEmpresa,
} from "@/server/services/membros";

/**
 * Ações da tela Membros (D-030). A empresa vem da sessão; a permissão
 * (`membros:gerir`) e as regras ficam no serviço.
 */

export type ResultadoDoConvite = {
  email: string;
  link: string;
  expiraEm: string;
  /** O e-mail é um extra: o link aparece na tela de qualquer jeito. */
  emailEnviado: boolean;
};

export async function convidarAcao(dados: unknown): Promise<ResultadoDeAcao<ResultadoDoConvite>> {
  return executarAcao(async () => {
    const { sessao, empresa } = await exigirEmpresaAtiva();
    const convite = await convidarPessoa(db, contextoDa(sessao), empresa.empresaId, dados);
    const link = new URL(`/convite/${convite.token}`, env.URL_DO_APP).toString();

    let emailEnviado = true;
    try {
      await enviarEmail({
        para: convite.email,
        assunto: `${sessao.usuario.nome} convidou você para a ${empresa.nome} na Brasa`,
        texto: `Olá!\n\n${sessao.usuario.nome} convidou você para entrar na ${empresa.nome} na Brasa, onde os leads chegam classificados pela IA.\n\nPara aceitar, abra o link abaixo (vale por 7 dias) e entre ou crie a sua conta com este e-mail (${convite.email}):\n\n${link}\n\nSe você não esperava este convite, ignore esta mensagem.`,
      });
    } catch (erro) {
      emailEnviado = false;
      // Sem o link nem o e-mail no log: só o id do convite.
      logger.warn("Convite criado, mas o e-mail não foi enviado", {
        conviteId: convite.conviteId,
        erro,
      });
    }

    revalidatePath("/membros");
    return {
      email: convite.email,
      link,
      expiraEm: convite.expiraEm.toISOString(),
      emailEnviado,
    };
  });
}

export async function cancelarConviteAcao(conviteId: unknown): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const { sessao, empresa } = await exigirEmpresaAtiva();
    const id = validarEntrada(z.uuid("Convite inválido."), conviteId);
    await cancelarConviteDaEmpresa(db, contextoDa(sessao), empresa.empresaId, id);
    revalidatePath("/membros");
    return null;
  });
}

export async function removerMembroAcao(usuarioId: unknown): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const { sessao, empresa } = await exigirEmpresaAtiva();
    const id = validarEntrada(z.uuid("Pessoa inválida."), usuarioId);
    await removerMembroDaEmpresa(db, contextoDa(sessao), empresa.empresaId, id);
    revalidatePath("/membros");
    return null;
  });
}
