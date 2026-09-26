"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { ErroValidacao } from "@/lib/erros";
import { esquemaNome } from "@/lib/validacao/auth";
import { contextoDa, exigirSessao } from "@/server/auth/sessao";
import { executarAcao, type ResultadoDeAcao } from "@/server/http/acao";
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
