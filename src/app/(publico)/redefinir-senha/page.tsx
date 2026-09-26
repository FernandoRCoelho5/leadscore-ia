import type { Metadata } from "next";
import Link from "next/link";

import { FormularioRedefinirSenha } from "@/components/auth/FormulariosDeAcesso";
import { Alerta } from "@/components/ui/Avisos";

export const metadata: Metadata = { title: "Nova senha" };

export default async function PaginaRedefinirSenha({
  searchParams,
}: PageProps<"/redefinir-senha">) {
  const { token, error } = await searchParams;
  const tokenValido = typeof token === "string" && token.length > 0 && !error;

  return (
    <>
      <h1 className="text-2xl font-bold">Crie uma nova senha</h1>
      <div className="mt-6">
        {tokenValido ? (
          <FormularioRedefinirSenha token={token} />
        ) : (
          <Alerta tipo="erro">
            Este link não é mais válido.{" "}
            <Link href="/esqueci-senha" className="font-semibold underline underline-offset-2">
              Peça um novo link
            </Link>
            .
          </Alerta>
        )}
      </div>
    </>
  );
}
