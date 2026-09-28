import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormularioLogin } from "@/components/auth/FormulariosDeAcesso";
import { destinoSeguro } from "@/lib/validacao/auth";
import { obterSessao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { proximo, redefinida } = await searchParams;
  const destino = destinoSeguro(typeof proximo === "string" ? proximo : undefined);
  if (await obterSessao()) {
    redirect(destino);
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Entrar na Brasa</h1>
      <p className="mt-1 text-sm text-texto-suave">Seus leads mais quentes estão esperando.</p>
      <div className="mt-6">
        <FormularioLogin
          destino={destino}
          aviso={redefinida ? "Senha alterada. Entre com a nova senha." : undefined}
        />
      </div>
      <p className="mt-6 text-center text-sm text-texto-suave">
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          className="font-semibold text-marca-texto underline-offset-2 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </>
  );
}
