"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { COOKIE_EMPRESA_ATIVA, contextoDa, exigirSessao } from "@/server/auth/sessao";
import { executarAcao, validarEntrada, type ResultadoDeAcao } from "@/server/http/acao";
import { OPCOES_DE_COOKIE } from "@/server/http/cookies";
import { aceitarConvite } from "@/server/services/membros";

/**
 * Aceita o convite (D-030) e já abre o painel na empresa nova. O serviço
 * confere o e-mail, a validade e o papel de quem aceita.
 */
export async function aceitarConviteAcao(token: unknown): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const texto = validarEntrada(z.string().max(100), token);
    const { empresaId } = await aceitarConvite(db, contextoDa(sessao), texto);
    (await cookies()).set(COOKIE_EMPRESA_ATIVA, empresaId, OPCOES_DE_COOKIE);
    redirect("/painel");
  });
}
