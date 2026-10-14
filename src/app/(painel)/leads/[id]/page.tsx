import { ArrowLeft, Mail, Phone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { BotaoReanalisar, FormularioDeStatus, ZonaDeRisco } from "@/components/leads/AcoesDoLead";
import { MedidorDaNota } from "@/components/leads/MedidorDaNota";
import { BotaoCopiar } from "@/components/ui/BotaoCopiar";
import { classesDeBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { ConteudoQueChega } from "@/components/ui/Revelacao";
import { db } from "@/db";
import type { Analise } from "@/db/schema";
import { situacaoDaAnalise, type SituacaoDaAnalise } from "@/lib/analise";
import { formatarDataHora } from "@/lib/datas";
import { ErroNaoEncontrado } from "@/lib/erros";
import {
  ROTULO_DA_ANALISE,
  ROTULO_DA_CLASSIFICACAO,
  ROTULO_DA_ORIGEM,
  ROTULO_DO_STATUS,
} from "@/lib/rotulos";
import { pode } from "@/server/auth/permissoes";
import { contextoDa, exigirPermissao } from "@/server/auth/sessao";
import { obterDetalheDoLead, type DetalheDoLead } from "@/server/services/leads";

export const metadata: Metadata = { title: "Lead" };

/**
 * Vale também para as Server Actions desta página: a reanálise chama a IA
 * dentro da própria requisição (ver api/publico/[slug]/leads/route.ts).
 */
export const maxDuration = 120;

/** O que dizer quando ainda não há análise concluída. */
const SEM_ANALISE: Record<Exclude<SituacaoDaAnalise, "concluida">, string> = {
  pendente: "A análise vai começar em instantes.",
  nao_iniciada: "A análise deste lead não começou. Peça a análise agora.",
  interrompida: "A análise foi interrompida antes de terminar. Peça uma nova análise.",
  processando: "A IA está analisando este lead. Recarregue a página em alguns segundos.",
  falhou: "A análise falhou. Você pode pedir uma nova análise.",
  limite_atingido:
    "O limite de análises do mês acabou quando este lead chegou. Com saldo, peça uma nova análise.",
};

function mensagemSemAnalise(situacao: SituacaoDaAnalise): string {
  return situacao === "concluida" ? ROTULO_DA_ANALISE.concluida : SEM_ANALISE[situacao];
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="font-medium wrap-anywhere">{children ?? "—"}</dd>
    </div>
  );
}

/** Posição na revelação da análise (`.escalonado`), depois do termômetro. */
const emSeguida = (indice: number) => ({ "--i": indice }) as CSSProperties;

function RespostaSugerida({ analise, email }: { analise: Analise; email: string | null }) {
  const assunto = "Sobre o seu contato";
  return (
    <div style={emSeguida(8)} className="escalonado mt-5 animate-entrar">
      <h3 className="mb-2 text-sm font-semibold">Resposta sugerida</h3>
      <p className="rounded-md bg-superficie-2 p-4 text-sm whitespace-pre-wrap">
        {analise.respostaSugerida}
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <BotaoCopiar
          texto={analise.respostaSugerida}
          rotulo="Copiar resposta"
          confirmacao="Resposta copiada. Cole no WhatsApp ou no e-mail."
        />
        {email && (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(analise.respostaSugerida)}`}
            className={classesDeBotao("primaria")}
          >
            <Mail aria-hidden="true" className="size-4" />
            Responder por e-mail
          </a>
        )}
      </div>
    </div>
  );
}

function Historico({ analises }: { analises: Analise[] }) {
  return (
    <ol className="flex flex-col divide-y divide-borda">
      {analises.map((analise) => (
        <li key={analise.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
          <span className="text-texto-suave tabular-nums">
            {formatarDataHora(analise.createdAt)}
          </span>
          <BadgeClassificacao classificacao={analise.classificacao} />
          <span className="font-semibold tabular-nums">{analise.score}</span>
          <span className="text-texto-suave">
            {analise.mock ? "análise simulada" : analise.modelo} · prompt {analise.promptVersion}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function PaginaDoLead({ params }: PageProps<"/leads/[id]">) {
  const sessao = await exigirPermissao("leads:ver");
  if (!sessao.empresaAtiva) {
    notFound();
  }
  const { empresaId } = sessao.empresaAtiva;
  const { id } = await params;

  let detalhe: DetalheDoLead;
  try {
    detalhe = await obterDetalheDoLead(db, contextoDa(sessao), empresaId, id);
  } catch (erro) {
    if (erro instanceof ErroNaoEncontrado) {
      notFound();
    }
    throw erro;
  }
  const { lead, analises } = detalhe;
  const [ultima] = analises;
  const podeEditar = pode(sessao.ator, "leads:editar", empresaId);
  const anonimizado = lead.anonimizadoEm !== null;

  return (
    <ConteudoQueChega>
      <Link
        href="/leads"
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-texto-suave hover:text-texto"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Voltar para os leads
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 text-2xl font-bold wrap-anywhere">{lead.nome}</h1>
        {/* O título é um destaque: aqui a chama do quente fica viva (D-033). */}
        <BadgeClassificacao classificacao={lead.classificacaoAtual} vivo />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Cartao titulo="Análise da IA">
            {lead.statusAnalise === "concluida" && ultima && lead.classificacaoAtual ? (
              // Revelação: o termômetro enche e a nota conta; logo depois chegam
              // a justificativa e a resposta. A `key` refaz a revelação quando
              // uma análise nova chega (ex.: depois de "Analisar de novo").
              <div key={ultima.id}>
                <MedidorDaNota score={ultima.score} classificacao={lead.classificacaoAtual} />
                <p
                  style={emSeguida(6)}
                  className="escalonado mt-4 animate-entrar whitespace-pre-wrap"
                >
                  {ultima.justificativa}
                </p>
                <p
                  style={emSeguida(7)}
                  className="escalonado mt-2 animate-entrar text-xs text-texto-suave"
                >
                  {ROTULO_DA_CLASSIFICACAO[lead.classificacaoAtual]} · analisado em{" "}
                  {formatarDataHora(ultima.createdAt)}
                  {ultima.mock && " · análise simulada, sem IA"}
                </p>
                {!anonimizado && <RespostaSugerida analise={ultima} email={lead.email} />}
              </div>
            ) : (
              <p className="text-texto-suave">{mensagemSemAnalise(situacaoDaAnalise(lead))}</p>
            )}
            {podeEditar && !anonimizado && (
              <div className="mt-5 border-t border-borda pt-5">
                <BotaoReanalisar
                  leadId={lead.id}
                  rotulo={ultima ? "Analisar de novo" : "Analisar agora"}
                />
              </div>
            )}
          </Cartao>

          <Cartao titulo="Mensagem">
            <p className="whitespace-pre-wrap">{lead.mensagem ?? "—"}</p>
          </Cartao>

          {analises.length > 1 && (
            <Cartao titulo="Histórico de análises">
              <Historico analises={analises} />
            </Cartao>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <Cartao titulo="Contato">
            <dl className="flex flex-col gap-3">
              <Dado rotulo="E-mail">
                {lead.email && (
                  // E-mail não tem espaços: sem `wrap-anywhere`, um endereço longo
                  // passa da borda do cartão e cria rolagem lateral no celular.
                  <a
                    href={`mailto:${lead.email}`}
                    className="inline-flex max-w-full items-start gap-1.5 text-marca-texto hover:underline"
                  >
                    <Mail aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    <span className="min-w-0 wrap-anywhere">{lead.email}</span>
                  </a>
                )}
              </Dado>
              <Dado rotulo="Telefone">
                {lead.telefone && (
                  <a
                    href={`tel:${lead.telefone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex max-w-full items-start gap-1.5 text-marca-texto hover:underline"
                  >
                    <Phone aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    <span className="min-w-0 wrap-anywhere">{lead.telefone}</span>
                  </a>
                )}
              </Dado>
              <Dado rotulo="Empresa">{lead.empresaNome}</Dado>
              <Dado rotulo="Segmento">{lead.segmento}</Dado>
              <Dado rotulo="Origem">{ROTULO_DA_ORIGEM[lead.origem]}</Dado>
              <Dado rotulo="Recebido em">{formatarDataHora(lead.createdAt)}</Dado>
            </dl>
          </Cartao>

          <Cartao titulo="Andamento">
            {podeEditar ? (
              <FormularioDeStatus leadId={lead.id} statusAtual={lead.status} />
            ) : (
              <p className="font-medium">{ROTULO_DO_STATUS[lead.status]}</p>
            )}
          </Cartao>

          <Cartao titulo="LGPD">
            <p className="flex items-start gap-2 text-sm">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sucesso" />
              {anonimizado
                ? `Dados anonimizados em ${formatarDataHora(lead.anonimizadoEm ?? lead.updatedAt)}.`
                : lead.consentimentoEm
                  ? `Consentimento dado em ${formatarDataHora(lead.consentimentoEm)} (texto ${lead.consentimentoVersaoTexto ?? "sem versão"}).`
                  : "Consentimento registrado."}
            </p>
            {podeEditar && (
              <div className="mt-4 border-t border-borda pt-4">
                <ZonaDeRisco leadId={lead.id} anonimizado={anonimizado} />
              </div>
            )}
          </Cartao>
        </aside>
      </div>
    </ConteudoQueChega>
  );
}
