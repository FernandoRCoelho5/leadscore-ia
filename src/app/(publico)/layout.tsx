import Link from "next/link";

import { Logo } from "@/components/marca/Logo";

/** Telas de acesso: logotipo no topo e um cartão central com o formulário. */
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
    </main>
  );
}
