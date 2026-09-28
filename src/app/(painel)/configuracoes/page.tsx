import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { env } from "@/env";
import { Cabecalho } from "@/components/painel/Cabecalho";
import { FormularioPerfilDoNegocio } from "@/components/painel/FormularioPerfilDoNegocio";
import { BotaoCopiar } from "@/components/ui/BotaoCopiar";
import { classesDeBotao } from "@/components/ui/Botao";
import { codigoDeIncorporacao, enderecoDoFormulario } from "@/lib/incorporacao";
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
  const endereco = enderecoDoFormulario(env.URL_DO_APP, empresa.slug);
  const codigo = codigoDeIncorporacao(endereco, empresa.nome);

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
        <div className="flex h-fit flex-col gap-6">
          <section
            aria-labelledby="titulo-captacao"
            className="rounded-lg border border-borda bg-superficie p-5 text-sm"
          >
            <h2 id="titulo-captacao" className="font-semibold">
              Formulário de captação
            </h2>
            <p className="mt-1 text-texto-suave">
              Divulgue este endereço: cada envio vira um lead e é analisado pela IA.
            </p>
            <p className="mt-3 font-medium break-all">{endereco}</p>
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <a
                href={endereco}
                target="_blank"
                rel="noopener noreferrer"
                className={classesDeBotao("contorno")}
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                Abrir
                <span className="sr-only">(abre em outra aba)</span>
              </a>
              <BotaoCopiar texto={endereco} rotulo="Copiar link" />
            </div>
            <details className="mt-4 border-t border-borda pt-3">
              <summary className="cursor-pointer font-medium">Colocar no seu site</summary>
              <p className="mt-2 text-texto-suave">
                Cole este código na página de contato do seu site. O site precisa usar HTTPS.
              </p>
              {/* Área rolável: recebe foco para quem usa só o teclado conseguir rolar. */}
              <pre
                tabIndex={0}
                aria-label="Código para colocar o formulário no seu site"
                className="mt-2 overflow-x-auto rounded-md bg-superficie-2 p-3 text-xs"
              >
                <code>{codigo}</code>
              </pre>
              <div className="mt-2">
                <BotaoCopiar texto={codigo} rotulo="Copiar código" />
              </div>
            </details>
          </section>
          <aside className="rounded-lg border border-borda bg-superficie p-5 text-sm">
            <h2 className="font-semibold">{empresa.nome}</h2>
            <dl className="mt-3 flex flex-col gap-3">
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
      </div>
    </>
  );
}
