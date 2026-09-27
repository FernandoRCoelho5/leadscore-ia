"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { SITUACOES_DA_EMPRESA } from "@/lib/rotulos";
import { contextoDa, exigirSessao } from "@/server/auth/sessao";
import { executarAcao, validarEntrada, type ResultadoDeAcao } from "@/server/http/acao";
import {
  alterarBloqueioNaPlataforma,
  alterarLimiteDeAnalises,
  alterarSituacaoDaEmpresaNaPlataforma,
  LIMITE_MAXIMO_DE_ANALISES,
} from "@/server/services/administracao";

/**
 * Ações da administração (D-029). A permissão (só o admin altera; o suporte
 * só lê) é conferida no serviço, que também grava a auditoria. Aqui só se
 * valida o que veio do navegador.
 */

const esquemaDaEmpresa = z.uuid("Empresa inválida.");
const esquemaDoUsuario = z.uuid("Usuário inválido.");

const MENSAGEM_DO_LIMITE = `Use um número inteiro de 0 a ${LIMITE_MAXIMO_DE_ANALISES.toLocaleString("pt-BR")}.`;
const esquemaDoLimite = z
  .number(MENSAGEM_DO_LIMITE)
  .int(MENSAGEM_DO_LIMITE)
  .min(0, MENSAGEM_DO_LIMITE)
  .max(LIMITE_MAXIMO_DE_ANALISES, MENSAGEM_DO_LIMITE);

function atualizarTelas(caminho: string) {
  revalidatePath(caminho);
  // A visão geral da equipe mostra as contagens de empresas e usuários.
  revalidatePath("/painel");
}

export async function alterarSituacaoDaEmpresaAcao(
  empresaId: unknown,
  situacao: unknown,
): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const id = validarEntrada(esquemaDaEmpresa, empresaId);
    const nova = validarEntrada(z.enum(SITUACOES_DA_EMPRESA, "Situação inválida."), situacao);
    await alterarSituacaoDaEmpresaNaPlataforma(db, contextoDa(sessao), id, nova);
    atualizarTelas("/admin/empresas");
    return null;
  });
}

export async function alterarLimiteDaEmpresaAcao(
  empresaId: unknown,
  limite: unknown,
): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const id = validarEntrada(esquemaDaEmpresa, empresaId);
    const novo = validarEntrada(esquemaDoLimite, limite);
    await alterarLimiteDeAnalises(db, contextoDa(sessao), id, novo);
    atualizarTelas("/admin/empresas");
    return null;
  });
}

export async function alterarBloqueioDoUsuarioAcao(
  usuarioId: unknown,
  bloquear: unknown,
): Promise<ResultadoDeAcao<null>> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const id = validarEntrada(esquemaDoUsuario, usuarioId);
    const valor = validarEntrada(z.boolean("Pedido inválido."), bloquear);
    await alterarBloqueioNaPlataforma(db, contextoDa(sessao), id, valor);
    atualizarTelas("/admin/usuarios");
    return null;
  });
}
