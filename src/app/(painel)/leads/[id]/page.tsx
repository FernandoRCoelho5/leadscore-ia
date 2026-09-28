import { ArrowLeft, Mail, Phone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { BotaoReanalisar, FormularioDeStatus, ZonaDeRisco } from "@/components/leads/AcoesDoLead";
import { MedidorDaNota } from "@/components/leads/MedidorDaNota";
import { BotaoCopiar } from "@/components/ui/BotaoCopiar";
import { classesDeBotao } from "@/components/ui/Botao";
import { db } from "@/db";
import type { Analise, Lead } from "@/db/schema";
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
const SEM_ANALISE: Record<Exclude<Lead["statusAnalise"], "concluida">, string> = {
  pendente: "A análise vai começar em instantes.",
  processando: "A IA está analisando este lead. Recarregue a página em alguns segundos.",
  falhou: "A análise falhou. Você pode pedir uma nova análise.",
  limite_atingido:
    "O limite de análises do mês acabou quando este lead chegou. Com saldo, peça uma nova análise.",
};

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = `secao-${titulo
    .normalize("NFD")
    .replace(/[^a-z]/gi, "-")
    .toLowerCase()}`;
  return (
    <section
      aria-labelledby={id}
      className="rounded-lg border border-borda bg-superficie p-5 sm:p-6"
    >
      <h2 id={id} className="mb-4 text-lg font-semibold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="font-medium break-words">{children ?? "—"}</dd>
    </div>
  );
}

function RespostaSugerida({ analise, email }: { analise: Analise; email: string | null }) {
  const assunto = "Sobre o seu contato";
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-semibold">Resposta sugerida</h3>
      <p className="rounded-md bg-superficie-2 p-4 text-sm whitespace-pre-wrap">
        {analise.respostaSugerida}
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <BotaoCopiar texto={analise.respostaSugerida} rotulo="Copiar resposta" />
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
    <>
      <Link
        href="/leads"
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-texto-suave hover:text-texto"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Voltar para os leads
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold break-words">{lead.nome}</h1>
        <BadgeClassificacao classificacao={lead.classificacaoAtual} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Secao titulo="Análise da IA">
            {lead.statusAnalise === "concluida" && ultima && lead.classificacaoAtual ? (
              <>
                <MedidorDaNota score={ultima.score} classificacao={lead.classificacaoAtual} />
                <p className="mt-4 whitespace-pre-wrap">{ultima.justificativa}</p>
                <p className="mt-2 text-xs text-texto-suave">
                  {ROTULO_DA_CLASSIFICACAO[lead.classificacaoAtual]} · analisado em{" "}
                  {formatarDataHora(ultima.createdAt)}
                  {ultima.mock && " · análise simulada, sem IA"}
                </p>
                {!anonimizado && <RespostaSugerida analise={ultima} email={lead.email} />}
              </>
            ) : (
              <p className="text-texto-suave">
                {lead.statusAnalise === "concluida"
                  ? ROTULO_DA_ANALISE.concluida
                  : SEM_ANALISE[lead.statusAnalise]}
              </p>
            )}
            {podeEditar && !anonimizado && (
              <div className="mt-5 border-t border-borda pt-5">
                <BotaoReanalisar
                  leadId={lead.id}
                  rotulo={ultima ? "Analisar de novo" : "Analisar agora"}
                />
              </div>
            )}
          </Secao>

          <Secao titulo="Mensagem">
            <p className="whitespace-pre-wrap">{lead.mensagem ?? "—"}</p>
          </Secao>

          {analises.length > 1 && (
            <Secao titulo="Histórico de análises">
              <Historico analises={analises} />
            </Secao>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <Secao titulo="Contato">
            <dl className="flex flex-col gap-3">
              <Dado rotulo="E-mail">
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="inline-flex items-center gap-1.5 text-marca-texto hover:underline"
                  >
                    <Mail aria-hidden="true" className="size-4 shrink-0" />
                    {lead.email}
                  </a>
                )}
              </Dado>
              <Dado rotulo="Telefone">
                {lead.telefone && (
                  <a
                    href={`tel:${lead.telefone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-1.5 text-marca-texto hover:underline"
                  >
                    <Phone aria-hidden="true" className="size-4 shrink-0" />
                    {lead.telefone}
                  </a>
                )}
              </Dado>
              <Dado rotulo="Empresa">{lead.empresaNome}</Dado>
              <Dado rotulo="Segmento">{lead.segmento}</Dado>
              <Dado rotulo="Origem">{ROTULO_DA_ORIGEM[lead.origem]}</Dado>
              <Dado rotulo="Recebido em">{formatarDataHora(lead.createdAt)}</Dado>
            </dl>
          </Secao>

          <Secao titulo="Andamento">
            {podeEditar ? (
              <FormularioDeStatus leadId={lead.id} statusAtual={lead.status} />
            ) : (
              <p className="font-medium">{ROTULO_DO_STATUS[lead.status]}</p>
            )}
          </Secao>

          <Secao titulo="LGPD">
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
          </Secao>
        </aside>
      </div>
    </>
  );
}
