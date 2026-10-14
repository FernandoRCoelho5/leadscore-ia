import {
  ArrowRight,
  ChevronDown,
  ClipboardCopy,
  FileText,
  Gauge,
  KeyRound,
  ListOrdered,
  MapPin,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { DemonstracaoDeLeads } from "@/components/publico/DemonstracaoDeLeads";
import {
  CabecalhoPublico,
  PularParaOConteudo,
  RodapePublico,
} from "@/components/publico/EstruturaPublica";
import { Faiscas } from "@/components/publico/Faiscas";
import { classesDeBotao } from "@/components/ui/Botao";
import { obterSessao } from "@/server/auth/sessao";

/*
 * Landing da Brasa (D-033): abertura escura e quente com faíscas e a
 * demonstração do fluxo; depois, como funciona, benefícios, cuidado com os
 * dados, perguntas e a chamada final. Textos aprovados na Etapa 3; nenhum
 * número, cliente ou depoimento inventado, só o que o produto faz.
 */

const PASSOS: { titulo: string; texto: string; Icone: LucideIcon }[] = [
  {
    titulo: "O lead chega",
    texto: "Pelo link do formulário ou pelo iframe no seu site, com o consentimento da LGPD.",
    Icone: FileText,
  },
  {
    titulo: "A IA analisa",
    texto:
      "Em segundos, compara o pedido com o perfil do seu negócio e dá a nota: quente, morno ou frio, com a justificativa.",
    Icone: Sparkles,
  },
  {
    titulo: "Você age",
    texto: "Abra o lead, copie a resposta sugerida, ajuste e envie. O andamento fica registrado.",
    Icone: ClipboardCopy,
  },
];

const BENEFICIOS: { titulo: string; texto: string; Icone: LucideIcon }[] = [
  {
    titulo: "Prioridade clara",
    texto: "Os leads aparecem pela nota, e os quentes saltam aos olhos.",
    Icone: ListOrdered,
  },
  {
    titulo: "Resposta pronta",
    texto: "Uma sugestão escrita para o contexto de cada lead.",
    Icone: MessageSquareText,
  },
  {
    titulo: "Feita para o seu negócio",
    texto:
      "A IA usa o que você conta: o que a empresa faz, o cliente ideal, o ticket médio e as regiões.",
    Icone: Target,
  },
  {
    titulo: "A equipe junto",
    texto: "Convide pessoas por link, acompanhe o andamento e exporte em CSV.",
    Icone: UsersRound,
  },
];

const CUIDADOS: { texto: string; Icone: LucideIcon }[] = [
  {
    texto: "Consentimento registrado e anonimização a qualquer momento (LGPD).",
    Icone: ShieldCheck,
  },
  { texto: "Banco de dados no Brasil, em São Paulo.", Icone: MapPin },
  { texto: "Acesso por perfil e registro das ações sensíveis.", Icone: KeyRound },
  {
    texto: "Limite mensal de análises por empresa: você sabe quanto vai usar.",
    Icone: Gauge,
  },
];

const PERGUNTAS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "Preciso mudar meu site?",
    resposta: "Não. Use o link do formulário ou cole o iframe em qualquer página.",
  },
  {
    pergunta: "A IA responde sozinha ao cliente?",
    resposta: "Não. Ela sugere a resposta; quem envia é você.",
  },
  {
    pergunta: "E a LGPD?",
    resposta:
      "O formulário pede o consentimento, guarda a versão do texto aceita e qualquer lead pode ser anonimizado.",
  },
  {
    pergunta: "Dá para usar com a minha equipe?",
    resposta: "Sim. Convide pessoas por link; cada uma entra com a própria conta.",
  },
];

function ChamadaPrincipal({ logado }: { logado: boolean }) {
  return logado ? (
    <Link href="/painel" className={classesDeBotao("primaria")}>
      Ir para o painel
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  ) : (
    <Link href="/cadastro" className={classesDeBotao("primaria")}>
      Criar conta
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}

export default async function Inicio() {
  const logado = Boolean(await obterSessao());

  return (
    <>
      <PularParaOConteudo />

      {/* Abertura sempre escura e quente, nos dois temas (D-033). */}
      <div
        data-tema="escuro"
        className="relative isolate overflow-hidden bg-(image:--fundo-publico)"
      >
        <Faiscas />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[-10%] -bottom-32 -z-10 h-64 animate-respirar rounded-[50%] bg-(image:--brasa-ao-fundo)"
        />
        <CabecalhoPublico
          logado={logado}
          navegacao={
            <ul className="flex gap-1 text-sm">
              {[
                ["#como-funciona", "Como funciona"],
                ["#perguntas", "Perguntas"],
              ].map(([href, rotulo]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="inline-flex h-controle items-center rounded-md px-3 text-texto-suave hover:bg-superficie-2 hover:text-texto"
                  >
                    {rotulo}
                  </a>
                </li>
              ))}
            </ul>
          }
        />

        <section
          aria-labelledby="titulo-principal"
          className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pt-16 lg:pb-28"
        >
          <div className="flex flex-col gap-6">
            <p className="text-sm font-semibold tracking-wide text-marca-texto uppercase">
              Qualificação de leads com IA
            </p>
            {/* O título é a maior pintura da tela (LCP): aparece pronto, sem animação. */}
            <h1
              id="titulo-principal"
              className="text-4xl leading-[1.05] font-extrabold tracking-[-0.02em] text-balance sm:text-5xl lg:text-6xl"
            >
              Seus leads mais quentes, primeiro.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-texto-suave">
              A Brasa lê cada contato que chega pelo seu site, dá uma nota de 0 a 100 e mostra com
              quem falar primeiro e o que responder.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ChamadaPrincipal logado={logado} />
              <a href="#como-funciona" className={classesDeBotao("contorno")}>
                Ver como funciona
                <ChevronDown aria-hidden="true" className="size-4" />
              </a>
            </div>
          </div>
          <DemonstracaoDeLeads />
        </section>
      </div>

      <main id="conteudo" tabIndex={-1} className="outline-none">
        <section
          aria-labelledby="titulo-problema"
          className="revelar mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-20 text-center sm:px-6"
        >
          <h2
            id="titulo-problema"
            className="text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl"
          >
            Todo lead parece urgente. Nem todo é.
          </h2>
          <p className="text-lg text-pretty text-texto-suave">
            Quando os contatos chegam misturados, o cliente certo espera na fila junto com quem só
            queria saber o preço.
          </p>
          <ul
            aria-label="Como a Brasa classifica os leads"
            className="mt-4 flex flex-wrap justify-center gap-2"
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
        </section>

        <section
          id="como-funciona"
          aria-labelledby="titulo-como-funciona"
          className="scroll-mt-6 bg-superficie py-20"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
            <h2
              id="titulo-como-funciona"
              className="revelar text-3xl font-bold tracking-[-0.02em] text-balance"
            >
              Como funciona
            </h2>
            <ol className="grid gap-6 md:grid-cols-3">
              {PASSOS.map(({ titulo, texto, Icone }, indice) => (
                <li
                  key={titulo}
                  className="revelar relative flex flex-col gap-3 rounded-lg border border-borda bg-fundo p-6"
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-11 items-center justify-center rounded-full bg-quente-fundo text-quente-icone [&>svg]:size-5"
                    >
                      <Icone />
                    </span>
                    <span className="text-sm font-semibold text-marca-texto">
                      Passo {indice + 1}
                    </span>
                  </span>
                  <h3 className="text-xl font-semibold">{titulo}</h3>
                  <p className="text-texto-suave">{texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="titulo-beneficios" className="py-20">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6">
            <h2
              id="titulo-beneficios"
              className="revelar max-w-2xl text-3xl font-bold tracking-[-0.02em] text-balance"
            >
              Menos tempo decidindo quem atender. Mais tempo vendendo.
            </h2>
            <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
              {BENEFICIOS.map(({ titulo, texto, Icone }) => (
                <li key={titulo} className="revelar flex gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-superficie-2 text-marca-texto [&>svg]:size-5"
                  >
                    <Icone />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold">{titulo}</h3>
                    <p className="text-texto-suave">{texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="titulo-cuidados" className="bg-superficie py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <h2
              id="titulo-cuidados"
              className="revelar text-3xl font-bold tracking-[-0.02em] text-balance"
            >
              Cuidado com os seus dados desde o primeiro contato.
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {CUIDADOS.map(({ texto, Icone }) => (
                <li
                  key={texto}
                  className="revelar flex gap-3 rounded-lg border border-borda bg-fundo p-5"
                >
                  <Icone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-marca-texto" />
                  <p>{texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="perguntas"
          aria-labelledby="titulo-perguntas"
          className="mx-auto flex w-full max-w-3xl scroll-mt-6 flex-col gap-6 px-4 py-20 sm:px-6"
        >
          <h2 id="titulo-perguntas" className="text-3xl font-bold tracking-[-0.02em]">
            Perguntas frequentes
          </h2>
          <div className="flex flex-col divide-y divide-borda border-y border-borda">
            {PERGUNTAS.map(({ pergunta, resposta }) => (
              <details key={pergunta} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                  {pergunta}
                  <ChevronDown
                    aria-hidden="true"
                    className="size-5 shrink-0 text-texto-suave transition-transform duration-(--mov-padrao) group-open:rotate-180"
                  />
                </summary>
                <p className="animate-entrar pb-4 text-texto-suave">{resposta}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          data-tema="escuro"
          aria-labelledby="titulo-chamada"
          className="relative isolate overflow-hidden bg-(image:--fundo-publico)"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[-10%] -bottom-40 -z-10 h-72 animate-respirar rounded-[50%] bg-(image:--brasa-ao-fundo)"
          />
          <div className="revelar mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-4 py-24 text-center sm:px-6">
            <h2
              id="titulo-chamada"
              className="text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl"
            >
              Não deixe lead quente esfriar.
            </h2>
            <p className="text-lg text-texto-suave">
              Leva poucos minutos: conte sobre a sua empresa e divulgue o formulário.
            </p>
            <ChamadaPrincipal logado={logado} />
          </div>
        </section>
      </main>

      <RodapePublico logado={logado} />
    </>
  );
}
