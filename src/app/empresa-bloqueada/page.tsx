import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { sairAcao } from "@/app/acoes";
import { Logo } from "@/components/marca/Logo";
import { exigirSessao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Empresa bloqueada" };

/**
 * Aviso para o cliente cuja empresa foi bloqueada pela equipe Brasa. Sem
 * menu: não há nada do painel que ele possa usar enquanto durar o bloqueio.
 */
export default async function PaginaEmpresaBloqueada() {
  const sessao = await exigirSessao();
  if (!sessao.empresaBloqueada) {
    redirect("/painel");
  }

  return (
    <main id="conteudo" className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-lg items-center justify-between">
        <Logo className="h-8 w-auto" />
        <form action={sairAcao}>
          <button
            type="submit"
            className="min-h-11 cursor-pointer rounded-md px-3 py-2 text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto"
          >
            Sair
          </button>
        </form>
      </div>
      <section className="mt-8 w-full max-w-lg rounded-lg border border-borda bg-superficie p-6 shadow-sm sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-full bg-superficie-2 text-texto-suave">
          <Lock aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">O acesso da sua empresa está suspenso</h1>
        <div className="mt-3 flex flex-col gap-3 text-texto-suave">
          <p>
            A equipe Brasa bloqueou a conta da sua empresa. Enquanto o bloqueio durar, o painel fica
            indisponível e o formulário de captação não recebe novos contatos.
          </p>
          <p>
            Os leads e as configurações continuam guardados e voltam assim que a conta for
            reativada.
          </p>
          <p>
            Para entender o motivo ou reativar, fale com a equipe Brasa pelo mesmo canal em que
            contratou o serviço.
          </p>
        </div>
      </section>
    </main>
  );
}
