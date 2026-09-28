import { SearchX, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FiltrosDeUsuarios } from "@/components/admin/FiltrosDaAdministracao";
import { ListaDeUsuarios } from "@/components/admin/ListaDeUsuarios";
import { Cabecalho } from "@/components/painel/Cabecalho";
import { LinkDeExportacao } from "@/components/painel/LinkDeExportacao";
import { Paginacao } from "@/components/painel/Paginacao";
import { EstadoVazio } from "@/components/ui/Avisos";
import { classesDeBotao } from "@/components/ui/Botao";
import { db } from "@/db";
import {
  esquemaFiltrosDeUsuarios,
  normalizarParametros,
  urlComFiltros,
} from "@/lib/validacao/filtros";
import { pode } from "@/server/auth/permissoes";
import { contextoDa, exigirPermissao } from "@/server/auth/sessao";
import { listarUsuariosDaPlataforma } from "@/server/services/administracao";

export const metadata: Metadata = { title: "Usuários" };

/**
 * Usuários da plataforma (equipe e clientes), com busca, filtros, paginação e
 * exportação (D-029). Somente admin e suporte; bloquear é só do admin.
 */
export default async function PaginaUsuarios({ searchParams }: PageProps<"/admin/usuarios">) {
  const sessao = await exigirPermissao("usuarios:listar");
  const filtros = esquemaFiltrosDeUsuarios.parse(normalizarParametros(await searchParams));
  const pagina = await listarUsuariosDaPlataforma(
    db,
    contextoDa(sessao),
    { busca: filtros.busca, papel: filtros.papel, situacao: filtros.situacao },
    { pagina: filtros.pagina, porPagina: filtros.porPagina },
  );

  const atuais = {
    busca: filtros.busca,
    papel: filtros.papel,
    situacao: filtros.situacao,
    porPagina: filtros.porPagina,
  };
  const temFiltro = Boolean(filtros.busca || filtros.papel || filtros.situacao);

  return (
    <>
      <Cabecalho
        titulo="Usuários"
        descricao="Equipe Brasa e usuários das empresas clientes."
        acao={
          pagina.total > 0 && (
            <LinkDeExportacao
              href={urlComFiltros("/api/admin/usuarios/exportar", {
                ...atuais,
                porPagina: undefined,
              })}
            />
          )
        }
      />
      <FiltrosDeUsuarios valores={filtros} temFiltro={temFiltro} />

      {pagina.total === 0 ? (
        temFiltro ? (
          <EstadoVazio
            icone={<SearchX aria-hidden="true" />}
            titulo="Nenhum usuário com esses filtros"
            descricao="Tente outro termo de busca ou limpe os filtros."
            acao={
              <Link href="/admin/usuarios" className={classesDeBotao("contorno")}>
                Limpar filtros
              </Link>
            }
          />
        ) : (
          <EstadoVazio
            icone={<UsersRound aria-hidden="true" />}
            titulo="Nenhum usuário ainda"
            descricao="Os usuários aparecem aqui assim que criam a conta."
          />
        )
      ) : (
        <>
          <ListaDeUsuarios
            usuarios={pagina.itens}
            usuarioAtualId={sessao.usuario.id}
            podeBloquear={pode(sessao.ator, "plataforma:gerir-usuarios")}
          />
          <Paginacao
            {...pagina}
            nomeDosItens={pagina.total === 1 ? "usuário" : "usuários"}
            urlDaPagina={(numero) => urlComFiltros("/admin/usuarios", atuais, { pagina: numero })}
          />
        </>
      )}
    </>
  );
}
