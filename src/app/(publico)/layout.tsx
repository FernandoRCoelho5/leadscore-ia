import { CircleCheck } from "lucide-react";
import Link from "next/link";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { Logo } from "@/components/marca/Logo";
import { PularParaOConteudo } from "@/components/publico/EstruturaPublica";
import { CAMINHO_DA_POLITICA } from "@/lib/privacidade";

const PONTOS = [
  "Nota de 0 a 100 para cada contato",
  "Resposta sugerida, pronta para ajustar",
  "Consentimento da LGPD desde o primeiro contato",
];

/**
 * Telas de acesso (entrar, criar conta, senha, convite). No computador, um
 * painel da marca, sempre escuro e quente (D-033), ao lado do formulário; no
 * celular, só o formulário. No rodapé, a política de privacidade (LGPD:
 * informar antes de coletar).
 */
export default function LayoutDeAcesso({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <PularParaOConteudo />

      <aside
        data-tema="escuro"
        aria-label="Sobre a Brasa"
        className="relative isolate hidden overflow-hidden bg-(image:--fundo-publico) lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[-20%] -bottom-40 -z-10 h-80 animate-respirar rounded-[50%] bg-(image:--brasa-ao-fundo)"
        />
        <Link href="/" aria-label="Brasa, página inicial" className="self-start rounded-md">
          <Logo decorativo className="h-9 w-auto" />
        </Link>
        <div className="flex flex-col gap-6">
          <p className="text-4xl leading-tight font-extrabold tracking-[-0.02em] text-balance">
            Seus leads mais quentes, primeiro.
          </p>
          <ul className="flex flex-col gap-3">
            {PONTOS.map((ponto) => (
              <li key={ponto} className="flex items-center gap-3 text-texto-suave">
                <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-marca-texto" />
                {ponto}
              </li>
            ))}
          </ul>
          <div
            aria-hidden="true"
            className="relative isolate flex max-w-sm animate-entrar items-center gap-3 rounded-lg border border-borda bg-superficie p-4"
          >
            <span className="pointer-events-none absolute -inset-px -z-10 animate-respirar rounded-[inherit] shadow-brilho-quente" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">Juliana Castro</p>
              <p className="truncate text-sm text-texto-suave">Distribuidora Vale Sul · agora</p>
            </div>
            <BadgeClassificacao classificacao="quente" vivo />
            <span className="text-lg font-bold tabular-nums">88</span>
          </div>
        </div>
        <p className="text-sm text-texto-suave">Qualificação de leads com IA</p>
      </aside>

      <main
        id="conteudo"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center px-4 py-12 outline-none sm:px-6"
      >
        <Link href="/" aria-label="Brasa, página inicial" className="mb-8 rounded-md lg:hidden">
          <Logo decorativo className="h-9 w-auto" />
        </Link>
        {/* Sem animação de entrada: o título do formulário é a maior pintura da tela (LCP). */}
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
    </div>
  );
}
