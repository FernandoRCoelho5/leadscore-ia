import { ArrowRight, Link2, MessageSquareReply, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { Logo } from "@/components/marca/Logo";
import { classesDeBotao } from "@/components/ui/Botao";
import { obterSessao } from "@/server/auth/sessao";

const PASSOS: { icone: ReactNode; titulo: string; texto: string }[] = [
  {
    icone: <Link2 aria-hidden="true" />,
    titulo: "Divulgue o formulário",
    texto: "Um link (ou um iframe no seu site) recebe os contatos, com o consentimento da LGPD.",
  },
  {
    icone: <Sparkles aria-hidden="true" />,
    titulo: "A IA dá a nota",
    texto:
      "Cada lead chega com nota de 0 a 100 e a classificação, comparado ao perfil do seu negócio.",
  },
  {
    icone: <MessageSquareReply aria-hidden="true" />,
    titulo: "Atenda os quentes primeiro",
    texto: "Com a justificativa e uma resposta sugerida, pronta para você ajustar e enviar.",
  },
];

/**
 * Página inicial: apresenta o produto e leva ao cadastro ou ao login. Quem já
 * entrou vê o atalho para o painel.
 */
export default async function Inicio() {
  const sessao = await obterSessao();

  return (
    <main id="conteudo" className="flex flex-1 flex-col items-center px-4 py-16 sm:px-6">
      <div className="flex w-full max-w-4xl flex-col items-center gap-10 text-center">
        <Logo className="h-10 w-auto sm:h-12" />

        <div className="flex max-w-xl flex-col gap-4">
          <h1 className="text-3xl leading-tight font-bold text-balance sm:text-4xl">
            Seus leads mais quentes, primeiro.
          </h1>
          <p className="text-lg text-pretty text-texto-suave">
            A Brasa analisa cada contato com inteligência artificial e mostra com quem falar
            primeiro e o que dizer.
          </p>
        </div>

        <ul
          aria-label="Como a Brasa classifica os leads"
          className="flex flex-wrap justify-center gap-2"
        >
          <li>
            <BadgeClassificacao classificacao="quente" />
          </li>
          <li>
            <BadgeClassificacao classificacao="morno" />
          </li>
          <li>
            <BadgeClassificacao classificacao="frio" />
          </li>
        </ul>

        <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          {sessao ? (
            <Link href="/painel" className={classesDeBotao("primaria")}>
              Ir para o painel
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : (
            <>
              <Link href="/cadastro" className={classesDeBotao("primaria")}>
                Criar conta
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link href="/login" className={classesDeBotao("contorno")}>
                Entrar
              </Link>
            </>
          )}
        </div>

        <section aria-labelledby="como-funciona" className="mt-6 w-full">
          <h2 id="como-funciona" className="text-xl font-semibold">
            Como funciona
          </h2>
          <ol className="mt-6 grid gap-4 text-left sm:grid-cols-3">
            {PASSOS.map((passo, indice) => (
              <li
                key={passo.titulo}
                className="flex flex-col gap-2 rounded-lg border border-borda bg-superficie p-5"
              >
                <span className="flex items-center gap-2 text-marca-texto [&>svg]:size-5">
                  {passo.icone}
                  <span className="text-sm font-semibold">Passo {indice + 1}</span>
                </span>
                <h3 className="font-semibold">{passo.titulo}</h3>
                <p className="text-sm text-texto-suave">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
