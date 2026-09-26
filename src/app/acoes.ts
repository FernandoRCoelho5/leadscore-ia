"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/env";
import { COOKIE_DO_TEMA, lerTema } from "@/lib/tema";
import { auth } from "@/server/auth/auth";
import { COOKIE_EMPRESA_ATIVA, exigirSessao } from "@/server/auth/sessao";

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
