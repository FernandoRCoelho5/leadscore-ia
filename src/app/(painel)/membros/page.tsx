import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormularioDeConvite } from "@/components/membros/FormularioDeConvite";
import { ListaDeConvites, ListaDeMembros } from "@/components/membros/ListasDeMembros";
import { Cabecalho } from "@/components/painel/Cabecalho";
import { Paginacao } from "@/components/painel/Paginacao";
import { EstadoVazio } from "@/components/ui/Avisos";
import { db } from "@/db";
import {
  esquemaPaginacaoDaUrl,
  normalizarParametros,
  urlComFiltros,
} from "@/lib/validacao/filtros";
import { DIAS_DE_VALIDADE_DO_CONVITE } from "@/lib/validacao/membros";
import { pode } from "@/server/auth/permissoes";
import { contextoDa, exigirPermissao } from "@/server/auth/sessao";
import { listarConvitesDaEmpresa, listarMembrosDaEmpresa } from "@/server/services/membros";

export const metadata: Metadata = { title: "Membros" };

function Secao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {titulo}
        </h2>
        {descricao && <p className="text-sm text-texto-suave">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Pessoas com acesso à empresa ativa e convites pendentes (D-030). O cliente
 * convida e remove na própria empresa; admin, em qualquer uma; o suporte só vê.
 */
export default async function PaginaMembros({ searchParams }: PageProps<"/membros">) {
  const sessao = await exigirPermissao("membros:ver");
  if (!sessao.empresaAtiva) {
    notFound();
  }
  const { empresaId, nome } = sessao.empresaAtiva;
  const paginacao = esquemaPaginacaoDaUrl.parse(normalizarParametros(await searchParams));
  const contexto = contextoDa(sessao);
  const [membros, convites] = await Promise.all([
    listarMembrosDaEmpresa(db, contexto, empresaId, paginacao),
    listarConvitesDaEmpresa(db, contexto, empresaId),
  ]);
  const podeGerir = pode(sessao.ator, "membros:gerir", empresaId);

  return (
    <>
      <Cabecalho titulo="Membros" descricao={`Pessoas com acesso aos leads da ${nome}.`} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <Secao id="pessoas" titulo="Pessoas">
            {membros.total === 0 ? (
              <EstadoVazio
                icone={<UsersRound aria-hidden="true" />}
                titulo="Ninguém na empresa ainda"
                descricao="Convide as pessoas que atendem os leads."
              />
            ) : (
              <>
                <ListaDeMembros
                  membros={membros.itens}
                  usuarioAtualId={sessao.usuario.id}
                  podeGerir={podeGerir}
                />
                <Paginacao
                  {...membros}
                  nomeDosItens={membros.total === 1 ? "pessoa" : "pessoas"}
                  urlDaPagina={(numero) =>
                    urlComFiltros(
                      "/membros",
                      { porPagina: paginacao.porPagina },
                      { pagina: numero },
                    )
                  }
                />
              </>
            )}
          </Secao>

          {convites.length > 0 && (
            <Secao
              id="convites"
              titulo="Convites pendentes"
              descricao="Links gerados e ainda não usados."
            >
              <ListaDeConvites convites={convites} podeGerir={podeGerir} />
            </Secao>
          )}
        </div>

        {podeGerir && (
          <aside
            aria-labelledby="convidar"
            className="rounded-lg border border-borda bg-superficie p-5 sm:p-6"
          >
            <h2 id="convidar" className="text-lg font-semibold">
              Convidar pessoa
            </h2>
            <p className="mt-1 mb-4 text-sm text-texto-suave">
              Geramos um link que vale por {DIAS_DE_VALIDADE_DO_CONVITE} dias. A pessoa entra ou
              cria a conta com o e-mail convidado e passa a ver os leads da {nome}.
            </p>
            <FormularioDeConvite />
          </aside>
        )}
      </div>
    </>
  );
}
