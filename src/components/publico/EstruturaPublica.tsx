import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/marca/Logo";
import { classesDeBotao } from "@/components/ui/Botao";
import { CAMINHO_DA_POLITICA } from "@/lib/privacidade";

/** Link "Pular para o conteúdo", primeiro elemento focável das páginas públicas. */
export function PularParaOConteudo() {
  return (
    <a
      href="#conteudo"
      className="sr-only rounded-md bg-superficie px-4 py-2 text-sm font-semibold text-texto shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      Pular para o conteúdo
    </a>
  );
}

/**
 * Topo das páginas públicas: logotipo e o caminho para entrar ou criar a conta
 * (quem já entrou vê o atalho para o painel). Poucos links: não precisa de
 * menu escondido no celular.
 */
export function CabecalhoPublico({
  logado,
  navegacao,
}: {
  logado: boolean;
  navegacao?: ReactNode;
}) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
      <Link href="/" aria-label="Brasa, página inicial" className="rounded-md">
        <Logo decorativo className="h-8 w-auto" />
      </Link>
      {navegacao && (
        <nav aria-label="Seções da página" className="ml-6 hidden md:block">
          {navegacao}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-2">
        {logado ? (
          <Link href="/painel" className={classesDeBotao("primaria")}>
            Ir para o painel
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="inline-flex h-controle items-center rounded-md px-3 text-sm font-semibold hover:bg-superficie-2"
            >
              Entrar
            </Link>
            <Link href="/cadastro" className={classesDeBotao("primaria")}>
              Criar conta
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

/** Rodapé das páginas públicas. */
export function RodapePublico({ logado }: { logado: boolean }) {
  return (
    <footer className="border-t border-borda">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo decorativo className="h-7 w-auto self-start" />
          <p className="text-sm text-texto-suave">Seus leads mais quentes, primeiro.</p>
        </div>
        <nav aria-label="Rodapé">
          <ul className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
            {(logado
              ? [["/painel", "Ir para o painel"]]
              : [
                  ["/login", "Entrar"],
                  ["/cadastro", "Criar conta"],
                ]
            ).map(([href, rotulo]) => (
              <li key={href}>
                <Link
                  href={href ?? "/"}
                  className="inline-flex min-h-11 items-center rounded-md px-2 text-texto-suave hover:text-texto hover:underline"
                >
                  {rotulo}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={CAMINHO_DA_POLITICA}
                className="inline-flex min-h-11 items-center rounded-md px-2 text-texto-suave hover:text-texto hover:underline"
              >
                Política de privacidade
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-texto-suave sm:px-6">
        © 2026 Brasa · qualificação de leads com IA
      </p>
    </footer>
  );
}
