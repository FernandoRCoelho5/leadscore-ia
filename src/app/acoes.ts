"use server";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { env } from "@/env";
import { ErroApp } from "@/lib/erros";
import { COOKIE_DO_TEMA, lerTema } from "@/lib/tema";
import { auth } from "@/server/auth/auth";
import { COOKIE_EMPRESA_ATIVA, contextoDa, exigirSessao } from "@/server/auth/sessao";
import { abrirEmpresaParaEquipe } from "@/server/services/administracao";

/** Ações globais do menu da conta. Funcionam como formulários comuns (até sem JavaScript). */

const UM_ANO = 60 * 60 * 24 * 365;

const opcoesDeCookie = {
  path: "/",
  maxAge: UM_ANO,
  sameSite: "lax",
  httpOnly: true,
  secure: env.NODE_ENV === "production",
} as const;

export async function definirTemaAcao(formulario: FormData): Promise<void> {
  const tema = lerTema(String(formulario.get("tema") ?? ""));
  (await cookies()).set(COOKIE_DO_TEMA, tema, opcoesDeCookie);
}

export async function sairAcao(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  // A empresa aberta pela equipe não sobrevive ao login seguinte: cada acesso
  // novo passa pela lista de empresas e fica na auditoria.
  (await cookies()).delete(COOKIE_EMPRESA_ATIVA);
  redirect("/login");
}

/** Troca a empresa ativa, aceitando só empresas das quais o usuário é membro. */
export async function definirEmpresaAtivaAcao(formulario: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const empresaId = String(formulario.get("empresaId") ?? "");
  if (sessao.vinculos.some((vinculo) => vinculo.empresaId === empresaId)) {
    (await cookies()).set(COOKIE_EMPRESA_ATIVA, empresaId, opcoesDeCookie);
  }
  redirect("/painel");
}

/** Acesso da equipe a uma empresa de cliente: dura um turno de trabalho, não um ano. */
const OITO_HORAS = 60 * 60 * 8;

/**
 * A equipe Brasa (admin e suporte) abre a empresa de um cliente para ver os
 * leads dela (D-029). O acesso é conferido no serviço e fica na auditoria.
 */
export async function abrirEmpresaAcao(formulario: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const empresaId = String(formulario.get("empresaId") ?? "");
  try {
    await abrirEmpresaParaEquipe(db, contextoDa(sessao), empresaId);
  } catch (erro) {
    if (erro instanceof ErroApp) {
      notFound();
    }
    throw erro;
  }
  (await cookies()).set(COOKIE_EMPRESA_ATIVA, empresaId, { ...opcoesDeCookie, maxAge: OITO_HORAS });
  redirect("/painel");
}

/** Fecha a empresa aberta pela equipe e volta para a lista de empresas. */
export async function sairDaEmpresaAcao(): Promise<void> {
  const sessao = await exigirSessao();
  (await cookies()).delete(COOKIE_EMPRESA_ATIVA);
  redirect(sessao.papel === "cliente" ? "/painel" : "/admin/empresas");
}
