"use client";

import { CircleCheck, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ResumoDeErros } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { AreaDeTexto, CaixaDeMarcacao, CampoTexto, Selecao } from "@/components/ui/Campo";
import { useFormulario, type ResultadoDoEnvio } from "@/components/ui/useFormulario";
import type { DetalheDeCampo } from "@/lib/erros";
import { CAMINHO_DA_POLITICA } from "@/lib/privacidade";
import {
  CAMPO_ARMADILHA,
  CAMPO_CARIMBO,
  MENSAGEM_MAXIMO,
  SEGMENTOS,
  esquemaLeadPublico,
} from "@/lib/validacao/lead";

type Props = {
  slug: string;
  nomeDaEmpresa: string;
  /** Horário de abertura da página, assinado pelo servidor (anti-spam). */
  carimbo: string;
};

type CorpoDeErro = { erro?: { mensagem?: unknown; detalhes?: unknown } };

const SEM_CONEXAO = "Não foi possível enviar. Confira a sua conexão e tente de novo.";

/** Envia os valores como estão no formulário; a rota valida tudo de novo. */
async function enviarLead(
  slug: string,
  valores: Record<string, string>,
): Promise<ResultadoDoEnvio> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api/publico/${encodeURIComponent(slug)}/leads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valores),
    });
  } catch {
    return { ok: false, erro: { mensagem: SEM_CONEXAO } };
  }
  if (resposta.ok) {
    return { ok: true };
  }
  const corpo = (await resposta.json().catch(() => null)) as CorpoDeErro | null;
  const mensagem = corpo?.erro?.mensagem;
  const detalhes = corpo?.erro?.detalhes;
  return {
    ok: false,
    erro: {
      mensagem: typeof mensagem === "string" ? mensagem : SEM_CONEXAO,
      detalhes: Array.isArray(detalhes) ? (detalhes as DetalheDeCampo[]) : undefined,
    },
  };
}

/**
 * Formulário público de captação (D-028). Segue o padrão dos formulários da
 * Brasa: validação imediata no navegador, erros ao lado de cada campo e resumo
 * que recebe o foco. Ao enviar, o formulário dá lugar à confirmação.
 */
export function FormularioDeCaptacao({ slug, nomeDaEmpresa, carimbo }: Props) {
  const [emailInformado, setEmailInformado] = useState("");
  const { aoEnviar, erros, erroGeral, pendente, sucesso, refResumo } = useFormulario({
    esquema: esquemaLeadPublico,
    enviar: async (dados, brutos) => {
      setEmailInformado(dados.email);
      return enviarLead(slug, brutos);
    },
  });

  if (sucesso) {
    return <Confirmacao nomeDaEmpresa={nomeDaEmpresa} email={emailInformado} />;
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
      <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoTexto
          id="nome"
          rotulo="Seu nome"
          autoComplete="name"
          required
          maxLength={120}
          erro={erros.nome}
        />
        <CampoTexto
          id="email"
          rotulo="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          erro={erros.email}
        />
        <CampoTexto
          id="telefone"
          rotulo="Telefone"
          opcional
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={30}
          placeholder="(24) 99999-0000"
          erro={erros.telefone}
        />
        <CampoTexto
          id="empresaNome"
          rotulo="Empresa"
          opcional
          autoComplete="organization"
          maxLength={160}
          erro={erros.empresaNome}
        />
      </div>
      <Selecao
        id="segmento"
        rotulo="Segmento da sua empresa"
        opcional
        opcoes={SEGMENTOS}
        textoVazio="Escolha um segmento"
        erro={erros.segmento}
      />
      <AreaDeTexto
        id="mensagem"
        rotulo="Como podemos ajudar?"
        rows={5}
        required
        maxLength={MENSAGEM_MAXIMO}
        ajuda="Conte o objetivo, o prazo e o tamanho da sua empresa: assim a resposta vem mais certeira."
        erro={erros.mensagem}
      />

      <details className="rounded-md bg-superficie-2 px-3 py-2.5 text-sm text-texto-suave">
        <summary className="cursor-pointer font-medium text-texto">
          Como seus dados são usados
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <p>
            {nomeDaEmpresa} recebe seus dados para responder a este contato. Eles ficam guardados na
            Brasa, a plataforma que {nomeDaEmpresa} usa para organizar os contatos.
          </p>
          <p>
            Uma análise automática com inteligência artificial (Anthropic, nos Estados Unidos) lê a
            mensagem, a empresa e o segmento para ajudar a priorizar o atendimento. Seu nome, e-mail
            e telefone não são enviados para essa análise, e ela não decide sozinha se você será
            atendido.
          </p>
          <p>
            Você pode pedir a {nomeDaEmpresa}, a qualquer momento, acesso, correção ou eliminação
            dos seus dados. Mais detalhes na{" "}
            <a
              href={CAMINHO_DA_POLITICA}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-marca-texto underline underline-offset-2 hover:no-underline"
            >
              política de privacidade da Brasa
              <span className="sr-only"> (abre em outra aba)</span>
            </a>
            .
          </p>
        </div>
      </details>

      <CaixaDeMarcacao
        id="consentimento"
        value="sim"
        required
        rotulo={`Concordo que ${nomeDaEmpresa} use estes dados para responder ao meu contato, como descrito acima.`}
        erro={erros.consentimento}
      />

      {/* Anti-spam (D-028): invisível para pessoas e leitores de tela; robôs costumam preencher. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor={CAMPO_ARMADILHA}>Não preencha este campo</label>
        <input
          id={CAMPO_ARMADILHA}
          name={CAMPO_ARMADILHA}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <input type="hidden" name={CAMPO_CARIMBO} value={carimbo} />

      <Botao type="submit" carregando={pendente} larguraTotal>
        {!pendente && <Send aria-hidden="true" className="size-4" />}
        {pendente ? "Enviando…" : "Enviar mensagem"}
      </Botao>
    </form>
  );
}

function Confirmacao({ nomeDaEmpresa, email }: { nomeDaEmpresa: string; email: string }) {
  const refTitulo = useRef<HTMLHeadingElement>(null);

  // O formulário some: o foco vai para o título, e o leitor de tela anuncia o sucesso.
  useEffect(() => {
    refTitulo.current?.focus();
  }, []);

  return (
    <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
      <CircleCheck aria-hidden="true" className="size-12 text-sucesso" />
      <h2 ref={refTitulo} tabIndex={-1} className="text-xl font-semibold text-texto">
        Mensagem enviada
      </h2>
      <p className="max-w-sm text-texto-suave">
        Obrigado pelo contato! {nomeDaEmpresa} recebeu sua mensagem e vai responder no e-mail:
        {/* Linha própria: um e-mail longo só quebra se não couber na largura inteira. */}
        <span className="mt-1 block font-medium wrap-anywhere text-texto">{email}</span>
      </p>
    </div>
  );
}
