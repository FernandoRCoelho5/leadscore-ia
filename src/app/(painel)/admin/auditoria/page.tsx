import { ScrollText, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FiltrosDaAuditoria } from "@/components/admin/FiltrosDaAdministracao";
import { ListaDaAuditoria } from "@/components/admin/ListaDaAuditoria";
import { Cabecalho } from "@/components/painel/Cabecalho";
import { LinkDeExportacao } from "@/components/painel/LinkDeExportacao";
import { Paginacao } from "@/components/painel/Paginacao";
import { EstadoVazio } from "@/components/ui/Avisos";
import { classesDeBotao } from "@/components/ui/Botao";
import { db } from "@/db";
import {
  esquemaFiltrosDaAuditoria,
  filtrosDaAuditoriaDoRepositorio,
  normalizarParametros,
  urlComFiltros,
} from "@/lib/validacao/filtros";
import { contextoDa, exigirPermissao } from "@/server/auth/sessao";
import { consultarAuditoria } from "@/server/services/administracao";

export const metadata: Metadata = { title: "Auditoria" };

/**
 * Registro das ações sensíveis (logins, acessos da equipe, exportações,
 * exclusões, anonimizações...), com filtros, paginação e exportação (D-029).
 * Somente admin e suporte; ninguém altera nem apaga eventos.
 */
export default async function PaginaAuditoria({ searchParams }: PageProps<"/admin/auditoria">) {
  const sessao = await exigirPermissao("auditoria:ver");
  const filtros = esquemaFiltrosDaAuditoria.parse(normalizarParametros(await searchParams));
  const pagina = await consultarAuditoria(
    db,
    contextoDa(sessao),
    filtrosDaAuditoriaDoRepositorio(filtros),
    { pagina: filtros.pagina, porPagina: filtros.porPagina },
  );

  const atuais = {
    acao: filtros.acao,
    de: filtros.de,
    ate: filtros.ate,
    porPagina: filtros.porPagina,
  };
  const temFiltro = Boolean(filtros.acao || filtros.de || filtros.ate);

  return (
    <>
      <Cabecalho
        titulo="Auditoria"
        descricao="Ações sensíveis na plataforma, da mais recente para a mais antiga. Os registros não podem ser alterados."
        acao={
          pagina.total > 0 && (
            <LinkDeExportacao
              href={urlComFiltros("/api/admin/auditoria/exportar", {
                ...atuais,
                porPagina: undefined,
              })}
            />
          )
        }
      />
      <FiltrosDaAuditoria valores={filtros} temFiltro={temFiltro} />

      {pagina.total === 0 ? (
        temFiltro ? (
          <EstadoVazio
            icone={<SearchX aria-hidden="true" />}
            titulo="Nenhum evento com esses filtros"
            descricao="Escolha outra ação, amplie o período ou limpe os filtros."
            acao={
              <Link href="/admin/auditoria" className={classesDeBotao("contorno")}>
                Limpar filtros
              </Link>
            }
          />
        ) : (
          <EstadoVazio
            icone={<ScrollText aria-hidden="true" />}
            titulo="Nenhum evento ainda"
            descricao="Logins, acessos da equipe, exportações, exclusões e anonimizações aparecem aqui."
          />
        )
      ) : (
        <>
          <ListaDaAuditoria eventos={pagina.itens} />
          <Paginacao
            {...pagina}
            nomeDosItens={pagina.total === 1 ? "evento" : "eventos"}
            urlDaPagina={(numero) => urlComFiltros("/admin/auditoria", atuais, { pagina: numero })}
          />
        </>
      )}
    </>
  );
}
