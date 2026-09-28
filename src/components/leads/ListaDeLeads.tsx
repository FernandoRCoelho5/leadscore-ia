import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { Lead } from "@/db/schema";
import { formatarDataHora } from "@/lib/datas";
import { ROTULO_DA_ANALISE, ROTULO_DO_STATUS } from "@/lib/rotulos";

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
          <span className="text-xs text-texto-suave">{ROTULO_DA_ANALISE[lead.statusAnalise]}</span>
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
      <div className="hidden overflow-hidden rounded-lg border border-borda bg-superficie md:block">
        {/* table-fixed: as colunas de tamanho previsível têm largura definida e o
            nome fica com o resto, truncado (em layout automático, max-width na
            célula não segura texto sem quebra e a tabela passa da tela). */}
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Leads</caption>
          <thead className="border-b border-borda bg-superficie-2 text-texto-suave">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Lead
              </th>
              <th scope="col" className="w-48 px-4 py-3 font-medium">
                Classificação
              </th>
              <th scope="col" className="w-32 px-4 py-3 font-medium">
                Andamento
              </th>
              <th scope="col" className="w-44 px-4 py-3 font-medium whitespace-nowrap">
                Recebido em
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-superficie-2">
                <td className="px-4 py-3">
                  <Link
                    href={`${caminhoDoDetalhe}/${lead.id}`}
                    className="block truncate font-semibold text-texto hover:text-marca-texto hover:underline"
                  >
                    {lead.nome}
                  </Link>
                  <Contato lead={lead} />
                </td>
                <td className="px-4 py-3">
                  <Classificacao lead={lead} />
                </td>
                <td className="px-4 py-3">{ROTULO_DO_STATUS[lead.status]}</td>
                <td className="px-4 py-3 whitespace-nowrap text-texto-suave tabular-nums">
                  {formatarDataHora(lead.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
