import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/marca/Logo";
import { env } from "@/env";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a Brasa trata os dados pessoais de quem usa a plataforma e dos leads.",
};

/** Data da versão em vigor; muda a cada alteração do texto. */
const ATUALIZADA_EM = "27 de setembro de 2026";

/** Links dentro do texto corrido: sublinhados sempre, não só pela cor (WCAG 1.4.1). */
const LINK = "font-medium text-marca-texto underline underline-offset-2 hover:no-underline";

function Lista({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-texto-suave">{children}</ul>;
}

function Contato() {
  if (!env.PRIVACIDADE_CONTATO) {
    // Só acontece fora da produção: lá a variável é obrigatória (src/env.ts).
    return <>pelo canal de contato (ainda não configurado neste ambiente)</>;
  }
  return (
    <>
      pelo e-mail{" "}
      <a href={`mailto:${env.PRIVACIDADE_CONTATO}`} className={LINK}>
        {env.PRIVACIDADE_CONTATO}
      </a>
    </>
  );
}

const SECOES: { id: string; titulo: string; conteudo: ReactNode }[] = [
  {
    id: "quem-somos",
    titulo: "Quem somos e a quem esta política se aplica",
    conteudo: (
      <>
        <p>
          A Brasa é uma plataforma que ajuda empresas a organizar e priorizar os contatos (leads)
          que chegam pelos formulários delas. Esta política explica quais dados pessoais passam pela
          plataforma, para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de
          Dados (LGPD, Lei nº 13.709/2018).
        </p>
        <p>Há dois grupos de pessoas, com papéis diferentes na lei:</p>
        <Lista>
          <li>
            <strong>Quem tem conta na Brasa</strong> (pessoas das empresas clientes e da nossa
            equipe): para esses dados, a Brasa é a <em>controladora</em>, ou seja, decide como eles
            são tratados.
          </li>
          <li>
            <strong>Quem preenche o formulário de uma empresa</strong> (os leads): a empresa dona do
            formulário é a controladora. A Brasa é a <em>operadora</em>: guarda e organiza esses
            dados em nome da empresa, seguindo as instruções dela.
          </li>
        </Lista>
      </>
    ),
  },
  {
    id: "dados",
    titulo: "Quais dados tratamos",
    conteudo: (
      <>
        <p>
          <strong>Contas:</strong>
        </p>
        <Lista>
          <li>nome, e-mail e, se você quiser, uma foto de perfil;</li>
          <li>
            senha: guardamos só um resumo criptográfico dela (hash com scrypt), nunca a senha em si;
          </li>
          <li>as empresas de que você participa e o seu perfil de acesso;</li>
          <li>
            endereço IP e navegador de cada sessão, enquanto ela estiver ativa (a sessão termina
            quando você sai ou depois de 7 dias sem uso);
          </li>
          <li>
            o registro das ações sensíveis (entrada, convites, exportações, alterações de perfil),
            sem o conteúdo dos leads.
          </li>
        </Lista>
        <p>
          <strong>Leads:</strong>
        </p>
        <Lista>
          <li>
            o que a pessoa escreve no formulário: nome, e-mail, telefone, empresa, segmento e
            mensagem;
          </li>
          <li>a data e a versão do texto de consentimento que ela aceitou;</li>
          <li>
            um código calculado a partir do IP (não o IP em si), usado só para barrar envios em
            massa;
          </li>
          <li>a nota, a classificação e a justificativa da análise feita com IA.</li>
        </Lista>
        <p>
          <strong>Cookies:</strong> usamos só os necessários para o funcionamento: o da sessão (para
          manter você conectado), o do tema (claro ou escuro) e, para a nossa equipe de suporte, o
          da empresa que ela está atendendo. Não usamos cookies de publicidade nem de análise de
          navegação.
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    titulo: "Para que usamos os dados",
    conteudo: (
      <Lista>
        <li>
          <strong>Prestar o serviço</strong> a quem tem conta: entrar, gerenciar a empresa, os
          membros e os leads. Base legal: execução de contrato (art. 7º, V).
        </li>
        <li>
          <strong>Proteger a plataforma</strong> contra acessos indevidos, fraudes e abusos:
          sessões, limite de tentativas e registro das ações sensíveis. Base legal: legítimo
          interesse (art. 7º, IX).
        </li>
        <li>
          <strong>Responder e priorizar os leads</strong>, em nome da empresa dona do formulário. O
          formulário pede o consentimento da pessoa (art. 7º, I) e registra a versão do texto
          aceito.
        </li>
        <li>
          <strong>Enviar e-mails do serviço</strong>, como convites e recuperação de senha.
        </li>
      </Lista>
    ),
  },
  {
    id: "ia",
    titulo: "Análise com inteligência artificial",
    conteudo: (
      <>
        <p>
          Cada lead recebe uma nota de 0 a 100, calculada por um modelo de IA da Anthropic a partir
          do perfil do negócio da empresa e de quatro informações do lead: empresa, segmento,
          mensagem e origem.{" "}
          <strong>O nome, o e-mail e o telefone do lead nunca são enviados para a IA.</strong>
        </p>
        <p>
          A nota ajuda a empresa a decidir por onde começar o atendimento; ela não decide sozinha se
          alguém será atendido. Quem preencheu o formulário pode pedir à empresa que revise uma
          decisão tomada com base nessa análise (art. 20).
        </p>
      </>
    ),
  },
  {
    id: "compartilhamento",
    titulo: "Com quem compartilhamos",
    conteudo: (
      <>
        <p>
          Não vendemos dados pessoais nem os usamos para publicidade. Para funcionar, a Brasa conta
          com estes fornecedores, que tratam os dados só para prestar o serviço:
        </p>
        <Lista>
          <li>
            <strong>Vercel</strong>: hospedagem da aplicação e das fotos de perfil, com servidores
            em São Paulo.
          </li>
          <li>
            <strong>Neon</strong>: banco de dados, com servidores em São Paulo.
          </li>
          <li>
            <strong>Anthropic</strong> (Estados Unidos): análise dos leads com IA, só com as
            informações descritas acima.
          </li>
          <li>
            <strong>Resend</strong> (Estados Unidos): envio dos e-mails do serviço, com o endereço
            do destinatário e o conteúdo da mensagem.
          </li>
        </Lista>
        <p>
          O envio para a Anthropic e para a Resend é uma transferência internacional de dados (art.
          33). Também podemos fornecer dados a autoridades quando a lei ou uma ordem judicial
          exigir.
        </p>
      </>
    ),
  },
  {
    id: "retencao",
    titulo: "Por quanto tempo guardamos",
    conteudo: (
      <Lista>
        <li>
          <strong>Contas:</strong> enquanto a conta existir. Se você pedir a exclusão, os seus dados
          pessoais são anonimizados: o nome e o e-mail são substituídos, a foto é desvinculada e o
          acesso é encerrado.
        </li>
        <li>
          <strong>Sessões:</strong> até você sair ou até 7 dias sem uso.
        </li>
        <li>
          <strong>Leads:</strong> enquanto a empresa dona do formulário quiser. Ela pode excluir um
          lead, que sai das telas, ou anonimizá-lo: nome, contatos, empresa e mensagem são apagados
          de forma definitiva, e ficam só dados estatísticos (segmento, nota e datas). Planilhas que
          a empresa exportou antes disso ficam fora do alcance da Brasa.
        </li>
        <li>
          <strong>Registro das ações sensíveis:</strong> enquanto a plataforma existir, para
          segurança e prestação de contas. Ele não guarda o conteúdo dos leads.
        </li>
      </Lista>
    ),
  },
  {
    id: "direitos",
    titulo: "Seus direitos",
    conteudo: (
      <>
        <p>Pela LGPD (art. 18), você pode pedir, a qualquer momento:</p>
        <Lista>
          <li>a confirmação de que tratamos dados seus e o acesso a eles;</li>
          <li>a correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>a anonimização, o bloqueio ou a eliminação de dados desnecessários;</li>
          <li>a portabilidade dos dados a outro fornecedor;</li>
          <li>a informação sobre com quem compartilhamos os seus dados;</li>
          <li>a revogação do consentimento, quando ele for a base do tratamento;</li>
          <li>a revisão de decisões tomadas com base em tratamento automatizado (art. 20).</li>
        </Lista>
        <p>
          <strong>Se você preencheu o formulário de uma empresa,</strong> faça o pedido a ela, que é
          a controladora dos seus dados. Se preferir, escreva para nós e encaminhamos.{" "}
          <strong>Se você tem conta,</strong> nome, foto e senha podem ser alterados no seu perfil,
          e os demais pedidos são atendidos <Contato />. Respondemos em até 15 dias.
        </p>
        <p>
          Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em{" "}
          <a href="https://www.gov.br/anpd" className={LINK} rel="noopener noreferrer">
            gov.br/anpd
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "seguranca",
    titulo: "Como protegemos os dados",
    conteudo: (
      <>
        <Lista>
          <li>todas as conexões usam HTTPS;</li>
          <li>senhas guardadas só como hash (scrypt);</li>
          <li>
            cada empresa só vê os próprios leads, e cada pessoa só faz o que o perfil dela permite;
          </li>
          <li>as ações sensíveis ficam registradas e não podem ser alteradas;</li>
          <li>banco de dados e hospedagem no Brasil;</li>
          <li>a IA recebe o mínimo necessário, sem nome nem contatos do lead.</li>
        </Lista>
        <p>
          Se acontecer um incidente de segurança que possa causar risco ou dano relevante, avisamos
          as pessoas afetadas e a ANPD (art. 48).
        </p>
      </>
    ),
  },
  {
    id: "menores",
    titulo: "Crianças e adolescentes",
    conteudo: (
      <p>A Brasa é feita para empresas e profissionais e não se destina a menores de 18 anos.</p>
    ),
  },
  {
    id: "alteracoes",
    titulo: "Alterações nesta política",
    conteudo: (
      <p>
        Quando esta política mudar, a data no topo da página é atualizada e, se a mudança for
        relevante, avisamos quem tem conta por e-mail.
      </p>
    ),
  },
  {
    id: "contato",
    titulo: "Contato",
    conteudo: (
      <p>
        Responsável pelo tratamento dos dados das contas: {env.PRIVACIDADE_RESPONSAVEL}. Dúvidas e
        pedidos sobre privacidade são atendidos <Contato />.
      </p>
    ),
  },
];

/**
 * Política de privacidade (LGPD). Pública, fora do layout de acesso: é um
 * texto longo, com largura de leitura (~70 caracteres por linha) e um
 * sumário com âncoras. O responsável e o contato vêm do ambiente (D-031).
 */
export default function PoliticaDePrivacidade() {
  return (
    <main id="conteudo" className="flex flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
      <article className="mx-auto flex w-full max-w-prose flex-col gap-8 leading-relaxed">
        <Link href="/" aria-label="Brasa, página inicial" className="self-start rounded-md">
          <Logo decorativo className="h-8 w-auto" />
        </Link>

        <header className="flex flex-col gap-2">
          <h1 className="text-3xl leading-tight font-bold text-balance">Política de privacidade</h1>
          <p className="text-sm text-texto-suave">Atualizada em {ATUALIZADA_EM}.</p>
        </header>

        <section
          aria-labelledby="resumo"
          className="rounded-lg border border-borda bg-superficie p-5 sm:p-6"
        >
          <h2 id="resumo" className="text-lg font-semibold">
            Em resumo
          </h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 marker:text-texto-suave">
            <li>Guardamos só o necessário para o serviço funcionar, no Brasil.</li>
            <li>Não vendemos dados nem usamos cookies de publicidade.</li>
            <li>A IA que dá a nota aos leads nunca recebe nome, e-mail ou telefone.</li>
            <li>
              Você pode pedir acesso, correção ou eliminação dos seus dados a qualquer momento.
            </li>
          </ul>
        </section>

        <nav aria-labelledby="sumario">
          <h2 id="sumario" className="text-lg font-semibold">
            Nesta página
          </h2>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 marker:text-texto-suave">
            {SECOES.map((secao) => (
              <li key={secao.id}>
                <a href={`#${secao.id}`} className={LINK}>
                  {secao.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {SECOES.map((secao, indice) => (
          <section key={secao.id} aria-labelledby={secao.id} className="flex flex-col gap-3">
            <h2 id={secao.id} className="scroll-mt-6 text-xl font-semibold text-balance">
              {indice + 1}. {secao.titulo}
            </h2>
            {secao.conteudo}
          </section>
        ))}

        <footer className="border-t border-borda pt-6">
          <Link href="/" className={`inline-flex items-center gap-2 ${LINK}`}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar para o início
          </Link>
        </footer>
      </article>
    </main>
  );
}
