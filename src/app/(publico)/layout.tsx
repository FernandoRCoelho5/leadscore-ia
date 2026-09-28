import Link from "next/link";

import { Logo } from "@/components/marca/Logo";
import { CAMINHO_DA_POLITICA } from "@/lib/privacidade";

/**
 * Telas de acesso: logotipo no topo, um cartão central com o formulário e, no
 * rodapé, a política de privacidade (LGPD: informar antes de coletar).
 */
export default function LayoutDeAcesso({ children }: LayoutProps<"/">) {
  return (
    <main
      id="conteudo"
      className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6"
    >
      <Link href="/" aria-label="Brasa, página inicial" className="mb-8 rounded-md">
        <Logo decorativo className="h-9 w-auto" />
      </Link>
      <div className="w-full max-w-md rounded-lg border border-borda bg-superficie p-6 shadow-sm sm:p-8">
        {children}
      </div>
      <Link
        href={CAMINHO_DA_POLITICA}
        className="mt-4 rounded-md px-2 py-3 text-sm text-texto-suave underline-offset-2 hover:text-texto hover:underline"
      >
        Política de privacidade
      </Link>
    </main>
  );
}
