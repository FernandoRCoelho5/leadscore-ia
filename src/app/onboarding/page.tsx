import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { sairAcao } from "@/app/acoes";
import { Logo } from "@/components/marca/Logo";
import { FormularioOnboarding } from "@/components/painel/FormularioOnboarding";
import { env } from "@/env";
import { exigirSessao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Sua empresa" };

export default async function PaginaOnboarding() {
  const sessao = await exigirSessao();
  // Só clientes sem empresa passam por aqui (empresa bloqueada não conta como "sem").
  if (sessao.empresaBloqueada) {
    redirect("/empresa-bloqueada");
  }
  if (sessao.papel !== "cliente" || sessao.empresaAtiva) {
    redirect("/painel");
  }

  return (
    <main id="conteudo" className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <Logo className="h-8 w-auto" />
        <form action={sairAcao}>
          <button
            type="submit"
            className="cursor-pointer rounded-md px-3 py-2 text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto"
          >
            Sair
          </button>
        </form>
      </div>
      <h1 className="mt-10 w-full max-w-2xl text-3xl font-extrabold tracking-[-0.02em] text-balance">
        Falta pouco para receber seus primeiros leads.
      </h1>
      <div className="mt-6 w-full max-w-2xl rounded-lg border border-borda bg-superficie p-6 shadow-sm sm:p-8">
        <FormularioOnboarding urlBase={env.URL_DO_APP} />
      </div>
    </main>
  );
}
