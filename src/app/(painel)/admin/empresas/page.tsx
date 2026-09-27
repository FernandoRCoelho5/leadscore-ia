import { Building2, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FiltrosDeEmpresas } from "@/components/admin/FiltrosDaAdministracao";
import { ListaDeEmpresas } from "@/components/admin/ListaDeEmpresas";
import { Cabecalho } from "@/components/painel/Cabecalho";
import { LinkDeExportacao } from "@/components/painel/LinkDeExportacao";
import { Paginacao } from "@/components/painel/Paginacao";
import { EstadoVazio } from "@/components/ui/Avisos";
import { classesDeBotao } from "@/components/ui/Botao";
import { db } from "@/db";
import {
  esquemaFiltrosDeEmpresas,
  normalizarParametros,
  urlComFiltros,
} from "@/lib/validacao/filtros";
import { pode } from "@/server/auth/permissoes";
import { contextoDa, exigirPermissao } from "@/server/auth/sessao";
import { listarEmpresasDaPlataforma } from "@/server/services/administracao";

export const metadata: Metadata = { title: "Empresas" };

/**
 * Empresas clientes, com busca, filtro, paginação e exportação (D-029).
 * Somente admin e suporte (matriz RBAC); para os demais, a página não existe (404).
 */
export default async function PaginaEmpresas({ searchParams }: PageProps<"/admin/empresas">) {
  const sessao = await exigirPermissao("empresas:listar");
  const filtros = esquemaFiltrosDeEmpresas.parse(normalizarParametros(await searchParams));
  const pagina = await listarEmpresasDaPlataforma(
    db,
    contextoDa(sessao),
    { busca: filtros.busca, situacao: filtros.situacao },
    { pagina: filtros.pagina, porPagina: filtros.porPagina },
  );

  const atuais = { busca: filtros.busca, situacao: filtros.situacao, porPagina: filtros.porPagina };
  const temFiltro = Boolean(filtros.busca || filtros.situacao);

  return (
    <>
      <Cabecalho
        titulo="Empresas"
        descricao="Clientes da plataforma. Abra uma empresa para ver os leads dela: o acesso fica registrado na auditoria."
        acao={
          pagina.total > 0 && (
            <LinkDeExportacao
              href={urlComFiltros("/api/admin/empresas/exportar", {
                ...atuais,
                porPagina: undefined,
              })}
            />
          )
        }
      />
      <FiltrosDeEmpresas valores={filtros} temFiltro={temFiltro} />

      {pagina.total === 0 ? (
        temFiltro ? (
          <EstadoVazio
            icone={<SearchX aria-hidden="true" />}
            titulo="Nenhuma empresa com esses filtros"
            descricao="Tente outro termo de busca ou limpe os filtros."
            acao={
              <Link href="/admin/empresas" className={classesDeBotao("contorno")}>
                Limpar filtros
              </Link>
            }
          />
        ) : (
          <EstadoVazio
            icone={<Building2 aria-hidden="true" />}
            titulo="Nenhuma empresa ainda"
            descricao="As empresas aparecem aqui quando um cliente cria a conta e conclui o cadastro da empresa."
          />
        )
      ) : (
        <>
          <ListaDeEmpresas
            empresas={pagina.itens}
            empresaAbertaId={sessao.acessoDaEquipe ? sessao.empresaAtiva?.empresaId : undefined}
            podeAdministrar={pode(sessao.ator, "empresa:administrar")}
          />
          <Paginacao
            {...pagina}
            nomeDosItens={pagina.total === 1 ? "empresa" : "empresas"}
            urlDaPagina={(numero) => urlComFiltros("/admin/empresas", atuais, { pagina: numero })}
          />
        </>
      )}
    </>
  );
}
