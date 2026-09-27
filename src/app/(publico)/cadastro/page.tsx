import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormularioCadastro } from "@/components/auth/FormulariosDeAcesso";
import { destinoSeguro } from "@/lib/validacao/auth";
import { obterSessao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Criar conta" };

export default async function PaginaCadastro({ searchParams }: PageProps<"/cadastro">) {
  // Com `proximo` (ex.: o link de um convite), volta para lá depois do
  // cadastro; sem ele, segue para o cadastro da empresa.
  const { proximo } = await searchParams;
  const volta = typeof proximo === "string" ? destinoSeguro(proximo) : undefined;
  if (await obterSessao()) {
    redirect(volta ?? "/painel");
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Crie sua conta</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Em seguida, conte sobre o seu negócio: é com isso que a IA pontua os leads.
      </p>
      <div className="mt-6">
        <FormularioCadastro destino={volta ?? "/onboarding"} />
      </div>
      <p className="mt-6 text-center text-sm text-texto-suave">
        Já tem conta?{" "}
        <Link
          href={volta ? `/login?proximo=${encodeURIComponent(volta)}` : "/login"}
          className="font-semibold text-marca-texto underline-offset-2 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </>
  );
}
