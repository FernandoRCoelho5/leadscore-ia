import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Linha, Tabela, Td, Th } from "@/components/ui/Tabela";
import type { Lead } from "@/db/schema";
import { situacaoDaAnalise } from "@/lib/analise";
import { formatarDataHora } from "@/lib/datas";
import { ROTULO_DA_SITUACAO_DA_ANALISE, ROTULO_DO_STATUS } from "@/lib/rotulos";

import { BadgeClassificacao } from "./BadgeClassificacao";

/**
 * Leads da página atual: tabela no computador e cartões no celular (sem
 * rolagem lateral). A nota vem ao lado do badge, que traz palavra, ícone e
 * cor; enquanto não há análise, o badge diz em que pé ela está.
 */

function Classificacao({ lead }: { lead: Lead }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <BadgeClassificacao classificacao={lead.classificacaoAtual} />
      {lead.scoreAtual !== null ? (
        <span className="text-sm font-semibold tabular-nums">
          {lead.scoreAtual}
          <span className="sr-only"> de 100</span>
        </span>
      ) : (
        lead.statusAnalise !== "concluida" && (
          <span className="text-xs text-texto-suave">
            {ROTULO_DA_SITUACAO_DA_ANALISE[situacaoDaAnalise(lead)]}
          </span>
        )
      )}
    </span>
  );
}

function Contato({ lead }: { lead: Lead }) {
  const partes = [lead.empresaNome, lead.email].filter(Boolean);
  return partes.length > 0 ? (
    <span className="block truncate text-sm text-texto-suave">{partes.join(" · ")}</span>
  ) : null;
}

export function ListaDeLeads({
  leads,
  caminhoDoDetalhe,
}: {
  leads: Lead[];
  caminhoDoDetalhe: string;
}) {
  return (
    <>
      {/* Celular: cartões. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link
              href={`${caminhoDoDetalhe}/${lead.id}`}
              className="flex items-center gap-3 rounded-lg border border-borda bg-superficie p-4 hover:bg-superficie-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{lead.nome}</p>
                <Contato lead={lead} />
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Classificacao lead={lead} />
                  <span className="text-texto-suave">{ROTULO_DO_STATUS[lead.status]}</span>
                </div>
                <p className="mt-1 text-xs text-texto-suave">{formatarDataHora(lead.createdAt)}</p>
              </div>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-texto-suave" />
            </Link>
          </li>
        ))}
      </ul>

      {/* Computador: tabela. */}
      <Tabela
        legenda="Leads"
        className="hidden md:block"
        cabecalho={
          <>
            <Th>Lead</Th>
            <Th className="w-48">Classificação</Th>
            <Th className="w-32">Andamento</Th>
            <Th className="w-44 whitespace-nowrap">Recebido em</Th>
          </>
        }
      >
        {leads.map((lead) => (
          <Linha key={lead.id}>
            <Td>
              <Link
                href={`${caminhoDoDetalhe}/${lead.id}`}
                className="block truncate font-semibold text-texto hover:text-marca-texto hover:underline"
              >
                {lead.nome}
              </Link>
              <Contato lead={lead} />
            </Td>
            <Td>
              <Classificacao lead={lead} />
            </Td>
            <Td>{ROTULO_DO_STATUS[lead.status]}</Td>
            <Td className="whitespace-nowrap text-texto-suave tabular-nums">
              {formatarDataHora(lead.createdAt)}
            </Td>
          </Linha>
        ))}
      </Tabela>
    </>
  );
}
