import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { FormularioDeCaptacao } from "@/components/captacao/FormularioDeCaptacao";
import { db } from "@/db";
import { env } from "@/env";
import { ErroNaoEncontrado } from "@/lib/erros";
import { obterFormularioPublico, type FormularioPublico } from "@/server/services/captacao";

import { MolduraDoFormulario } from "./MolduraDoFormulario";

/**
 * Formulário público de captação de uma empresa (D-028). Não exige login e
 * pode ser incorporado em iframe no site do cliente (o proxy libera o
 * `frame-ancestors` só para /f/). Mostra apenas o nome da empresa.
 */

// Uma consulta por requisição, compartilhada entre os metadados e a página.
const carregar = cache(async (slug: string): Promise<FormularioPublico | null> => {
  try {
    return await obterFormularioPublico(db, slug);
  } catch (erro) {
    if (erro instanceof ErroNaoEncontrado) {
      return null;
    }
    throw erro;
  }
});

export async function generateMetadata({ params }: PageProps<"/f/[slug]">): Promise<Metadata> {
  const formulario = await carregar((await params).slug);
  return {
    title: formulario ? `Fale com ${formulario.nomeDaEmpresa}` : "Formulário não encontrado",
    // O endereço é divulgado pela empresa; buscadores não precisam listar os clientes da Brasa.
    robots: { index: false, follow: false },
  };
}

export default async function PaginaDoFormulario({ params }: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  const formulario = await carregar(slug);
  if (!formulario) {
    notFound();
  }

  return (
    <MolduraDoFormulario urlDaBrasa={env.URL_DO_APP}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-balance text-texto">
          Fale com {formulario.nomeDaEmpresa}
        </h1>
        <p className="mt-2 text-texto-suave">
          Conte o que você precisa. A resposta chega no seu e-mail.
        </p>
      </header>
      <FormularioDeCaptacao
        slug={slug}
        nomeDaEmpresa={formulario.nomeDaEmpresa}
        carimbo={formulario.carimbo}
      />
    </MolduraDoFormulario>
  );
}
