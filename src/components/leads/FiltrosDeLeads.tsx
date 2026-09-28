import { FormularioDeFiltros } from "@/components/painel/FormularioDeFiltros";
import { CampoTexto, Selecao } from "@/components/ui/Campo";
import {
  CLASSIFICACOES,
  ROTULO_DA_CLASSIFICACAO,
  ROTULO_DO_STATUS,
  STATUS_DO_LEAD,
} from "@/lib/rotulos";
import { ORDENS_DE_LEADS, type FiltrosDaUrlDeLeads } from "@/lib/validacao/filtros";

/** Filtros da lista de leads (na URL, ver `FormularioDeFiltros`). */
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
    <FormularioDeFiltros caminho={caminho} rotulo="Filtrar leads" temFiltro={temFiltro}>
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
    </FormularioDeFiltros>
  );
}
