import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { env } from "@/env";
import { Cabecalho } from "@/components/painel/Cabecalho";
import { FormularioPerfilDoNegocio } from "@/components/painel/FormularioPerfilDoNegocio";
import { BotaoCopiar } from "@/components/ui/BotaoCopiar";
import { classesDeBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { ConteudoQueChega } from "@/components/ui/Revelacao";
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
    <ConteudoQueChega>
      <Cabecalho
        titulo="Empresa"
        descricao="O perfil do negócio é o contexto que a IA usa para dar nota a cada lead."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Cartao titulo="Perfil do negócio">
          <FormularioPerfilDoNegocio valores={empresa} />
        </Cartao>
        <div className="flex h-fit flex-col gap-6">
          <Cartao
            titulo="Formulário de captação"
            descricao="Divulgue este endereço: cada envio vira um lead e é analisado pela IA."
            className="text-sm"
          >
            <p className="font-medium break-all">{endereco}</p>
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
              <BotaoCopiar
                texto={endereco}
                rotulo="Copiar link"
                confirmacao="Link do formulário copiado."
              />
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
                <BotaoCopiar texto={codigo} rotulo="Copiar código" confirmacao="Código copiado." />
              </div>
            </details>
          </Cartao>
          <Cartao titulo={empresa.nome} className="text-sm">
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="text-texto-suave">Versão do perfil</dt>
                <dd className="font-medium tabular-nums">{empresa.perfilVersao}</dd>
              </div>
              <div>
                <dt className="text-texto-suave">Análises por mês</dt>
                <dd className="font-medium tabular-nums">até {empresa.limiteAnalisesMes}</dd>
              </div>
            </dl>
          </Cartao>
        </div>
      </div>
    </ConteudoQueChega>
  );
}
