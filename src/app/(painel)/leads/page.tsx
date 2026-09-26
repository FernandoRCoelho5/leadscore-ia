import { Download, Inbox, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FiltrosDeLeads } from "@/components/leads/FiltrosDeLeads";
import { ListaDeLeads } from "@/components/leads/ListaDeLeads";
import { Cabecalho } from "@/components/painel/Cabecalho";
import { Paginacao } from "@/components/painel/Paginacao";
import { EstadoVazio } from "@/components/ui/Avisos";
import { classesDeBotao } from "@/components/ui/Botao";
import { db } from "@/db";
import {
  esquemaFiltrosDeLeads,
  filtrosDoRepositorio,
  normalizarParametros,
  urlComFiltros,
} from "@/lib/validacao/filtros";
import { pode } from "@/server/auth/permissoes";
import { contextoDa, exigirPermissao } from "@/server/auth/sessao";
import { listarLeadsDaEmpresa } from "@/server/services/leads";

export const metadata: Metadata = { title: "Leads" };

/** Leads da empresa ativa, com busca, filtros, ordenação, paginação e exportação (D-029). */
export default async function PaginaLeads({ searchParams }: PageProps<"/leads">) {
  const sessao = await exigirPermissao("leads:ver");
  if (!sessao.empresaAtiva) {
    notFound();
  }
  const { empresaId, nome } = sessao.empresaAtiva;

  const filtros = esquemaFiltrosDeLeads.parse(normalizarParametros(await searchParams));
  const pagina = await listarLeadsDaEmpresa(
    db,
    contextoDa(sessao),
    empresaId,
    filtrosDoRepositorio(filtros),
    { pagina: filtros.pagina, porPagina: filtros.porPagina },
  );

  const atuais = {
    busca: filtros.busca,
    classificacao: filtros.classificacao,
    status: filtros.status,
    de: filtros.de,
    ate: filtros.ate,
    ordem: filtros.ordem,
    porPagina: filtros.porPagina,
  };
  const temFiltro = Boolean(
    filtros.busca || filtros.classificacao || filtros.status || filtros.de || filtros.ate,
  );
  const podeExportar = pode(sessao.ator, "leads:exportar", empresaId) && pagina.total > 0;

  return (
    <>
      <Cabecalho
        titulo="Leads"
        descricao={nome}
        acao={
          podeExportar && (
            <a
              href={urlComFiltros("/api/leads/exportar", { ...atuais, ordem: undefined })}
              download
              className={classesDeBotao("contorno")}
            >
              <Download aria-hidden="true" className="size-4" />
              Exportar CSV
            </a>
          )
        }
      />
      <FiltrosDeLeads caminho="/leads" valores={filtros} temFiltro={temFiltro} />

      {pagina.total === 0 ? (
        temFiltro ? (
          <EstadoVazio
            icone={<SearchX aria-hidden="true" />}
            titulo="Nenhum lead com esses filtros"
            descricao="Tente outro termo de busca, amplie o período ou limpe os filtros."
            acao={
              <Link href="/leads" className={classesDeBotao("contorno")}>
                Limpar filtros
              </Link>
            }
          />
        ) : (
          <EstadoVazio
            icone={<Inbox aria-hidden="true" />}
            titulo="Nenhum lead ainda"
            descricao="Divulgue o formulário de captação: cada contato chega aqui já classificado em quente, morno ou frio."
            acao={
              pode(sessao.ator, "empresa:editar", empresaId) ? (
                <Link href="/configuracoes" className={classesDeBotao("contorno")}>
                  Ver o link do formulário
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <ListaDeLeads leads={pagina.itens} caminhoDoDetalhe="/leads" />
          <Paginacao
            {...pagina}
            nomeDosItens={pagina.total === 1 ? "lead" : "leads"}
            urlDaPagina={(numero) => urlComFiltros("/leads", atuais, { pagina: numero })}
          />
        </>
      )}
    </>
  );
}
