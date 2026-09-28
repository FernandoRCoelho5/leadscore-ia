"use client";

import { useState } from "react";

import { criarEmpresaAcao } from "@/app/onboarding/acoes";
import { ResumoDeErros } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/Campo";
import { useFormulario } from "@/components/ui/useFormulario";
import { SLUG_MAXIMO, esquemaOnboarding, gerarSlug } from "@/lib/validacao/empresa";

import { CamposDoPerfilDoNegocio } from "./CamposDoPerfilDoNegocio";

/** Cadastro da empresa e do perfil do negócio, logo após criar a conta. */
export function FormularioOnboarding({ urlBase }: { urlBase: string }) {
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const { aoEnviar, erros, erroGeral, pendente, refResumo } = useFormulario({
    esquema: esquemaOnboarding,
    enviar: (_dados, brutos) => criarEmpresaAcao(brutos),
  });

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
      <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
      <CampoTexto
        id="nomeEmpresa"
        rotulo="Nome da empresa"
        autoComplete="organization"
        required
        maxLength={120}
        onChange={(evento) => {
          // Sugere o endereço a partir do nome até a pessoa editá-lo.
          if (!slugEditado) {
            setSlug(gerarSlug(evento.target.value));
          }
        }}
        erro={erros.nomeEmpresa}
      />
      <CampoTexto
        id="slug"
        rotulo="Endereço do formulário de captação"
        required
        maxLength={SLUG_MAXIMO}
        value={slug}
        onChange={(evento) => {
          setSlugEditado(true);
          setSlug(evento.target.value.toLowerCase());
        }}
        ajuda={
          <>
            Seu formulário ficará em{" "}
            <span className="font-medium break-all text-texto">
              {urlBase}/f/{slug || "sua-empresa"}
            </span>
            . Use letras minúsculas, números e hífens.
          </>
        }
        erro={erros.slug}
      />
      <CamposDoPerfilDoNegocio erros={erros} />
      <Botao type="submit" carregando={pendente} larguraTotal>
        Criar empresa e ir para o painel
      </Botao>
    </form>
  );
}
