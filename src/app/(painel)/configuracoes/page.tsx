import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { env } from "@/env";
import { Cabecalho } from "@/components/painel/Cabecalho";
import { FormularioPerfilDoNegocio } from "@/components/painel/FormularioPerfilDoNegocio";
import { exigirPermissao } from "@/server/auth/sessao";
import { obterEmpresa } from "@/server/repositories/empresas";

export const metadata: Metadata = { title: "Empresa" };

export default async function PaginaEmpresa() {
  const sessao = await exigirPermissao("empresa:ver");
  if (!sessao.empresaAtiva) {
    notFound();
  }
  const empresa = await obterEmpresa(db, sessao.empresaAtiva.empresaId);
  if (!empresa) {
    notFound();
  }

  return (
    <>
      <Cabecalho
        titulo="Empresa"
        descricao="O perfil do negócio é o contexto que a IA usa para dar nota a cada lead."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section
          aria-labelledby="titulo-perfil"
          className="rounded-lg border border-borda bg-superficie p-5 sm:p-6"
        >
          <h2 id="titulo-perfil" className="mb-5 text-lg font-semibold">
            Perfil do negócio
          </h2>
          <FormularioPerfilDoNegocio valores={empresa} />
        </section>
        <aside className="h-fit rounded-lg border border-borda bg-superficie p-5 text-sm">
          <h2 className="font-semibold">{empresa.nome}</h2>
          <dl className="mt-3 flex flex-col gap-3">
            <div>
              <dt className="text-texto-suave">Endereço do formulário público</dt>
              <dd className="font-medium break-all">
                {env.BETTER_AUTH_URL}/f/{empresa.slug}
              </dd>
            </div>
            <div>
              <dt className="text-texto-suave">Versão do perfil</dt>
              <dd className="font-medium tabular-nums">{empresa.perfilVersao}</dd>
            </div>
            <div>
              <dt className="text-texto-suave">Análises por mês</dt>
              <dd className="font-medium tabular-nums">até {empresa.limiteAnalisesMes}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
