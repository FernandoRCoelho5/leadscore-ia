import "server-only";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import {
  listarEmpresasDoUsuario,
  obterUsuarioAtivo,
  type VinculoDeEmpresa,
} from "@/server/repositories/usuarios";

import { auth } from "./auth";
import type { ContextoDoUsuario } from "@/server/services/contexto";

import { pode, type Acao, type Ator, type Papel } from "./permissoes";

/**
 * Sessão da requisição atual, já validada no servidor: o cookie de sessão é
 * conferido pelo Better Auth e o usuário é relido do banco (excluído ou
 * bloqueado perde o acesso na hora, sem esperar a sessão expirar).
 */
export type Sessao = {
  usuario: { id: string; nome: string; email: string; imagemUrl: string | null };
  papel: Papel;
  vinculos: VinculoDeEmpresa[];
  /** Empresa em que o usuário está trabalhando (cliente); nula para admin/suporte sem vínculo. */
  empresaAtiva: VinculoDeEmpresa | null;
  ator: Ator;
};

/** Cookie com a empresa escolhida por quem é membro de mais de uma. */
export const COOKIE_EMPRESA_ATIVA = "empresa_ativa";

/** `cache` do React: uma única leitura por requisição, mesmo chamada em vários lugares. */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const resultado = await auth.api.getSession({ headers: await headers() });
  if (!resultado) {
    return null;
  }
  const usuario = await obterUsuarioAtivo(db, resultado.user.id);
  if (!usuario || usuario.bloqueadoEm) {
    return null;
  }

  const vinculos = await listarEmpresasDoUsuario(db, usuario.id);
  const preferida = (await cookies()).get(COOKIE_EMPRESA_ATIVA)?.value;
  const empresaAtiva = vinculos.find((v) => v.empresaId === preferida) ?? vinculos[0] ?? null;
  const papel: Papel = usuario.papelPlataforma ?? "cliente";

  return {
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      imagemUrl: usuario.imagemUrl,
    },
    papel,
    vinculos,
    empresaAtiva,
    ator: { papel, empresaIds: vinculos.map((v) => v.empresaId) },
  };
});

/** Exige login; sem sessão, manda para a tela de login. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }
  return sessao;
}

/**
 * Exige login e, para clientes, uma empresa: quem acabou de se cadastrar
 * ainda não tem empresa e vai para o onboarding.
 */
export async function exigirSessaoComEmpresa(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel === "cliente" && !sessao.empresaAtiva) {
    redirect("/onboarding");
  }
  return sessao;
}

/**
 * Protege uma página por permissão. Sem permissão, responde 404: não revela
 * que a página existe para quem não pode usá-la.
 */
export async function exigirPermissao(acao: Acao): Promise<Sessao> {
  const sessao = await exigirSessaoComEmpresa();
  if (!pode(sessao.ator, acao)) {
    notFound();
  }
  return sessao;
}

/** Contexto que os serviços recebem (sem depender de cookies nem do Next.js). */
export function contextoDa(sessao: Sessao): ContextoDoUsuario {
  return { usuarioId: sessao.usuario.id, ator: sessao.ator };
}
