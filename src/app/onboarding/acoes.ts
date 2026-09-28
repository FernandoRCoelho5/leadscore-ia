"use server";

import { redirect } from "next/navigation";

import { db } from "@/db";
import { ErroValidacao } from "@/lib/erros";
import { esquemaOnboarding } from "@/lib/validacao/empresa";
import { contextoDa, exigirSessao } from "@/server/auth/sessao";
import { executarAcao, type ResultadoDeAcao } from "@/server/http/acao";
import { criarEmpresaNoOnboarding } from "@/server/services/empresas";

/** Cria a empresa do cliente recém-cadastrado; os dados são revalidados no servidor. */
export async function criarEmpresaAcao(dados: unknown): Promise<ResultadoDeAcao<null>> {
  const resultado = await executarAcao(async () => {
    const sessao = await exigirSessao();
    const validacao = esquemaOnboarding.safeParse(dados);
    if (!validacao.success) {
      throw ErroValidacao.deZod(validacao.error);
    }
    await criarEmpresaNoOnboarding(db, contextoDa(sessao), validacao.data);
    return null;
  });
  if (resultado.ok) {
    redirect("/painel");
  }
  return resultado;
}
