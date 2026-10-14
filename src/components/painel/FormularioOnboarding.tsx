"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { criarEmpresaAcao } from "@/app/onboarding/acoes";
import { ResumoDeErros } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/Campo";
import { IndicadorDeEtapas } from "@/components/ui/IndicadorDeEtapas";
import { obterEsquema, useFormulario } from "@/components/ui/useFormulario";
import { SLUG_MAXIMO, gerarSlug } from "@/lib/validacao/regras";

import { CamposDoPerfilDoNegocio } from "./CamposDoPerfilDoNegocio";

const ETAPAS = ["Conta criada", "Sua empresa", "Perfil do negócio"] as const;
/** Esquemas baixados sob demanda: o Zod não pesa no primeiro carregamento (D-040). */
const esquemaOnboarding = () => import("@/lib/validacao/empresa").then((m) => m.esquemaOnboarding);
/** Campos do passo "Sua empresa", validados antes de seguir. */
const esquemaDaEmpresa = () =>
  import("@/lib/validacao/empresa").then((m) => m.esquemaDaEmpresaNoOnboarding);
const CAMPOS_DA_EMPRESA = ["nomeEmpresa", "slug"];

/**
 * Cadastro da empresa e do perfil do negócio, logo após criar a conta, em
 * dois passos de um mesmo formulário: os campos do passo oculto continuam no
 * formulário e o envio final é o mesmo de antes (esquema completo e a mesma
 * Server Action). Se o servidor recusar o nome ou o endereço, volta ao passo
 * da empresa com o erro.
 */
export function FormularioOnboarding({ urlBase }: { urlBase: string }) {
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [errosDaEmpresa, setErrosDaEmpresa] = useState<Record<string, string>>({});
  const refFormulario = useRef<HTMLFormElement>(null);
  const refTitulo = useRef<HTMLHeadingElement>(null);
  const primeiraRenderizacao = useRef(true);
  const { aoEnviar, erros, erroGeral, pendente, refResumo } = useFormulario({
    esquema: esquemaOnboarding,
    enviar: (_dados, brutos) => criarEmpresaAcao(brutos),
  });

  // Erro em campo do passo anterior (ex.: endereço já usado): volta para ele.
  // Ajuste durante a renderização, quando chegam erros novos (padrão do React
  // para estado que depende de outro, sem efeito).
  const [errosConferidos, setErrosConferidos] = useState(erros);
  if (erros !== errosConferidos) {
    setErrosConferidos(erros);
    if (CAMPOS_DA_EMPRESA.some((campo) => erros[campo])) {
      setEtapa(1);
    }
  }

  // Ao trocar de passo, o foco vai para o título do passo (leitores de tela anunciam).
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    refTitulo.current?.focus();
  }, [etapa]);

  async function continuar() {
    const formulario = refFormulario.current;
    if (!formulario) {
      return;
    }
    const dados = new FormData(formulario);
    let validador;
    try {
      validador = await obterEsquema(esquemaDaEmpresa);
    } catch {
      // Sem rede para baixar a validação: segue, e o envio final (que o
      // servidor valida) devolve ao passo da empresa se algo estiver errado.
      setEtapa(2);
      return;
    }
    const validacao = validador.safeParse({
      nomeEmpresa: String(dados.get("nomeEmpresa") ?? ""),
      slug: String(dados.get("slug") ?? ""),
    });
    if (!validacao.success) {
      const porCampo: Record<string, string> = {};
      for (const issue of validacao.error.issues) {
        porCampo[issue.path.map(String).join(".")] ??= issue.message;
      }
      setErrosDaEmpresa(porCampo);
      const primeiro = CAMPOS_DA_EMPRESA.find((campo) => porCampo[campo]);
      if (primeiro) {
        document.getElementById(primeiro)?.focus();
      }
      return;
    }
    setErrosDaEmpresa({});
    setEtapa(2);
  }

  // Enter no passo da empresa segue para o próximo, em vez de enviar tudo.
  function aoTeclar(evento: KeyboardEvent<HTMLFormElement>) {
    if (etapa === 1 && evento.key === "Enter" && evento.target instanceof HTMLInputElement) {
      evento.preventDefault();
      void continuar();
    }
  }

  const errosVisiveis = { ...erros, ...errosDaEmpresa };

  return (
    <div className="flex flex-col gap-8">
      <IndicadorDeEtapas etapas={ETAPAS} atual={etapa} />
      <form
        ref={refFormulario}
        noValidate
        onSubmit={aoEnviar}
        onKeyDown={aoTeclar}
        className="flex flex-col gap-5"
      >
        <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
        <h2 ref={refTitulo} tabIndex={-1} className="text-2xl font-bold outline-none" key={etapa}>
          {etapa === 1 ? "Conte sobre a sua empresa" : "Como a IA deve pontuar seus leads"}
        </h2>
        <p className="-mt-3 text-sm text-texto-suave">
          {etapa === 1
            ? "O nome aparece no formulário que os seus clientes vão preencher."
            : "A IA usa essas informações para dar nota a cada lead. Dá para ajustar depois."}
        </p>

        {/* Os dois passos ficam no formulário; o oculto é enviado junto no final. */}
        <div hidden={etapa !== 1} className="flex animate-entrar flex-col gap-5">
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
            erro={errosVisiveis.nomeEmpresa}
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
            erro={errosVisiveis.slug}
          />
          <Botao onClick={continuar} larguraTotal>
            Continuar
            <ArrowRight aria-hidden="true" className="size-4" />
          </Botao>
        </div>

        <div hidden={etapa !== 2} className="flex animate-entrar flex-col gap-5">
          <CamposDoPerfilDoNegocio erros={errosVisiveis} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Botao variante="contorno" onClick={() => setEtapa(1)}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Voltar
            </Botao>
            <Botao type="submit" carregando={pendente} className="sm:flex-1">
              Criar empresa e ir para o painel
            </Botao>
          </div>
        </div>
      </form>
    </div>
  );
}
