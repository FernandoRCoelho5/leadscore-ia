import type { Metadata } from "next";
import Link from "next/link";

import { FormularioEsqueciSenha } from "@/components/auth/FormulariosDeAcesso";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function PaginaEsqueciSenha() {
  return (
    <>
      <h1 className="text-2xl font-bold">Esqueceu a senha?</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Informe o e-mail da sua conta e enviamos um link para criar uma nova.
      </p>
      <div className="mt-6">
        <FormularioEsqueciSenha />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link
          href="/login"
          className="font-semibold text-marca-texto underline-offset-2 hover:underline"
        >
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
