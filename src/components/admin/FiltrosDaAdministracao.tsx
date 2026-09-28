import { FormularioDeFiltros } from "@/components/painel/FormularioDeFiltros";
import { CampoTexto, Selecao } from "@/components/ui/Campo";
import { ACOES_DA_AUDITORIA, CODIGOS_DAS_ACOES } from "@/lib/auditoria";
import {
  PAPEIS_DE_ACESSO,
  ROTULO_DA_SITUACAO_DA_EMPRESA,
  ROTULO_DA_SITUACAO_DO_USUARIO,
  ROTULO_DO_PAPEL,
  SITUACOES_DA_EMPRESA,
  SITUACOES_DO_USUARIO,
} from "@/lib/rotulos";
import type {
  FiltrosDaUrlDaAuditoria,
  FiltrosDaUrlDeEmpresas,
  FiltrosDaUrlDeUsuarios,
} from "@/lib/validacao/filtros";

/** Filtros das listas da administração (na URL, ver `FormularioDeFiltros`). */

export function FiltrosDeEmpresas({
  valores,
  temFiltro,
}: {
  valores: FiltrosDaUrlDeEmpresas;
  temFiltro: boolean;
}) {
  return (
    <FormularioDeFiltros caminho="/admin/empresas" rotulo="Filtrar empresas" temFiltro={temFiltro}>
      <CampoTexto
        id="busca"
        rotulo="Buscar"
        type="search"
        placeholder="Nome ou endereço do formulário"
        defaultValue={valores.busca}
        maxLength={100}
        className="sm:col-span-2 lg:col-span-2"
      />
      <Selecao
        id="situacao"
        rotulo="Situação"
        opcoes={SITUACOES_DA_EMPRESA.map((valor) => ({
          valor,
          rotulo: ROTULO_DA_SITUACAO_DA_EMPRESA[valor],
        }))}
        textoVazio="Todas"
        defaultValue={valores.situacao ?? ""}
      />
    </FormularioDeFiltros>
  );
}

export function FiltrosDeUsuarios({
  valores,
  temFiltro,
}: {
  valores: FiltrosDaUrlDeUsuarios;
  temFiltro: boolean;
}) {
  return (
    <FormularioDeFiltros
      caminho="/admin/usuarios"
      rotulo="Filtrar usuários"
      temFiltro={temFiltro}
      colunas="lg:grid-cols-5"
    >
      <CampoTexto
        id="busca"
        rotulo="Buscar"
        type="search"
        placeholder="Nome ou e-mail"
        defaultValue={valores.busca}
        maxLength={100}
        className="sm:col-span-2 lg:col-span-2"
      />
      <Selecao
        id="papel"
        rotulo="Perfil"
        opcoes={PAPEIS_DE_ACESSO.map((valor) => ({ valor, rotulo: ROTULO_DO_PAPEL[valor] }))}
        textoVazio="Todos"
        defaultValue={valores.papel ?? ""}
      />
      <Selecao
        id="situacao"
        rotulo="Situação"
        opcoes={SITUACOES_DO_USUARIO.map((valor) => ({
          valor,
          rotulo: ROTULO_DA_SITUACAO_DO_USUARIO[valor],
        }))}
        textoVazio="Todas"
        defaultValue={valores.situacao ?? ""}
      />
    </FormularioDeFiltros>
  );
}

export function FiltrosDaAuditoria({
  valores,
  temFiltro,
}: {
  valores: FiltrosDaUrlDaAuditoria;
  temFiltro: boolean;
}) {
  return (
    <FormularioDeFiltros
      caminho="/admin/auditoria"
      rotulo="Filtrar a auditoria"
      temFiltro={temFiltro}
      colunas="lg:grid-cols-5"
    >
      <Selecao
        id="acao"
        rotulo="Ação"
        opcoes={CODIGOS_DAS_ACOES.map((valor) => ({ valor, ...ACOES_DA_AUDITORIA[valor] }))}
        textoVazio="Todas"
        defaultValue={valores.acao ?? ""}
        className="sm:col-span-2 lg:col-span-2"
      />
      <CampoTexto id="de" rotulo="De" type="date" defaultValue={valores.de} />
      <CampoTexto id="ate" rotulo="até" type="date" defaultValue={valores.ate} />
    </FormularioDeFiltros>
  );
}
