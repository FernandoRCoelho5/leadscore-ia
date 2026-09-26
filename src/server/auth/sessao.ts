import "server-only";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { enderecoDaFoto } from "@/server/armazenamento/fotos";
import { obterEmpresa } from "@/server/repositories/empresas";
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
  usuario: {
    id: string;
    nome: string;
    email: string;
    /** Endereço da rota autenticada que entrega a foto; nulo sem foto. */
    fotoUrl: string | null;
  };
  papel: Papel;
  vinculos: VinculoDeEmpresa[];
  /**
   * Empresa em que o usuário está trabalhando: para o cliente, uma das dele;
   * para admin e suporte, a que abriram pela lista de empresas (D-029), ou nula.
   */
  empresaAtiva: VinculoDeEmpresa | null;
  /** A empresa ativa foi aberta pela equipe Brasa (não é um vínculo de membro). */
  acessoDaEquipe: boolean;
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
  const papel: Papel = usuario.papelPlataforma ?? "cliente";
  let empresaAtiva = vinculos.find((v) => v.empresaId === preferida) ?? vinculos[0] ?? null;
  let acessoDaEquipe = false;

  // A equipe (admin e suporte) pode abrir qualquer empresa não excluída; o
  // cliente, só as dele (acima). O papel vem do banco, nunca do cookie.
  if (papel !== "cliente" && preferida && !vinculos.some((v) => v.empresaId === preferida)) {
    const empresa = await obterEmpresa(db, preferida);
    if (empresa) {
      empresaAtiva = { empresaId: empresa.id, nome: empresa.nome, slug: empresa.slug };
      acessoDaEquipe = true;
    }
  }

  return {
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      fotoUrl: enderecoDaFoto(usuario.id, usuario.imagemUrl),
    },
    papel,
    vinculos,
    empresaAtiva,
    acessoDaEquipe,
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
