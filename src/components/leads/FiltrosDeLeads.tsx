import { Search, X } from "lucide-react";
import Link from "next/link";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto, Selecao } from "@/components/ui/Campo";
import {
  CLASSIFICACOES,
  ROTULO_DA_CLASSIFICACAO,
  ROTULO_DO_STATUS,
  STATUS_DO_LEAD,
} from "@/lib/rotulos";
import { ORDENS_DE_LEADS, type FiltrosDaUrlDeLeads } from "@/lib/validacao/filtros";

/**
 * Filtros da lista de leads: um formulário GET comum. Os filtros ficam na URL,
 * então a lista filtrada pode ser salva nos favoritos, compartilhada e usada
 * pela exportação. Funciona sem JavaScript.
 */
export function FiltrosDeLeads({
  caminho,
  valores,
  temFiltro,
}: {
  caminho: string;
  valores: FiltrosDaUrlDeLeads;
  temFiltro: boolean;
}) {
  return (
    <form
      method="get"
      action={caminho}
      role="search"
      aria-label="Filtrar leads"
      className="mb-4 grid gap-4 rounded-lg border border-borda bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <CampoTexto
        id="busca"
        rotulo="Buscar"
        type="search"
        placeholder="Nome, e-mail ou empresa"
        defaultValue={valores.busca}
        maxLength={100}
        className="sm:col-span-2 lg:col-span-2"
      />
      <Selecao
        id="classificacao"
        rotulo="Classificação"
        opcoes={CLASSIFICACOES.map((valor) => ({
          valor,
          rotulo: ROTULO_DA_CLASSIFICACAO[valor],
        }))}
        textoVazio="Todas"
        defaultValue={valores.classificacao ?? ""}
      />
      <Selecao
        id="status"
        rotulo="Andamento"
        opcoes={STATUS_DO_LEAD.map((valor) => ({ valor, rotulo: ROTULO_DO_STATUS[valor] }))}
        textoVazio="Todos"
        defaultValue={valores.status ?? ""}
      />
      <CampoTexto id="de" rotulo="Recebidos de" type="date" defaultValue={valores.de} />
      <CampoTexto id="ate" rotulo="até" type="date" defaultValue={valores.ate} />
      <Selecao
        id="ordem"
        rotulo="Ordenar por"
        opcoes={Object.entries(ORDENS_DE_LEADS)
          .filter(([valor]) => valor !== "recentes")
          .map(([valor, { rotulo }]) => ({ valor, rotulo }))}
        textoVazio={ORDENS_DE_LEADS.recentes.rotulo}
        defaultValue={valores.ordem === "recentes" ? "" : (valores.ordem ?? "")}
      />
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
        {temFiltro && (
          <Link
            href={caminho}
            className="inline-flex h-controle items-center gap-2 rounded-md px-4 text-sm font-semibold text-texto hover:bg-superficie-2"
          >
            <X aria-hidden="true" className="size-4" />
            Limpar filtros
          </Link>
        )}
        <Botao type="submit" variante="primaria">
          <Search aria-hidden="true" className="size-4" />
          Filtrar
        </Botao>
      </div>
    </form>
  );
}
