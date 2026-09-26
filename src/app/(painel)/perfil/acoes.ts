"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { ErroValidacao } from "@/lib/erros";
import { esquemaNome } from "@/lib/validacao/auth";
import { FOTO_TAMANHO_MAXIMO } from "@/lib/validacao/foto";
import { armazenamentoNoBlob } from "@/server/armazenamento/fotos";
import { contextoDa, exigirSessao } from "@/server/auth/sessao";
import { executarAcao, type ResultadoDeAcao } from "@/server/http/acao";
import { alterarMinhaFoto, erroDeFoto, removerMinhaFoto } from "@/server/services/foto";
import { atualizarMeuNome } from "@/server/services/perfil";

const esquema = z.object({ nome: esquemaNome });

/** Altera o nome do próprio usuário (o ID vem da sessão, nunca do navegador). */
export async function salvarNomeAcao(dados: unknown): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const validacao = esquema.safeParse(dados);
    if (!validacao.success) {
      throw ErroValidacao.deZod(validacao.error);
    }
    await atualizarMeuNome(db, contextoDa(sessao), validacao.data.nome);
    // O nome aparece no menu da conta em todas as páginas.
    revalidatePath("/", "layout");
    return null;
  });
}

/**
 * Troca a foto do próprio usuário. O tamanho é conferido antes de ler o
 * arquivo; o tipo real (pelos bytes) é conferido no serviço.
 */
export async function enviarFotoAcao(formulario: FormData): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const arquivo = formulario.get("foto");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      throw erroDeFoto("vazia");
    }
    if (arquivo.size > FOTO_TAMANHO_MAXIMO) {
      throw erroDeFoto("grande");
    }
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    await alterarMinhaFoto(db, armazenamentoNoBlob, contextoDa(sessao), bytes);
    // A foto aparece no menu da conta em todas as páginas.
    revalidatePath("/", "layout");
    return null;
  });
}

export async function removerFotoAcao(): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    await removerMinhaFoto(db, armazenamentoNoBlob, contextoDa(sessao));
    revalidatePath("/", "layout");
    return null;
  });
}
