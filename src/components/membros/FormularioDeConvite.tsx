"use client";

import { MailCheck, MailWarning, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { convidarAcao, type ResultadoDoConvite } from "@/app/(painel)/membros/acoes";
import { ResumoDeErros } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { BotaoCopiar } from "@/components/ui/BotaoCopiar";
import { CampoTexto } from "@/components/ui/Campo";
import { useFormulario } from "@/components/ui/useFormulario";
import { formatarData } from "@/lib/datas";
import { esquemaConvite } from "@/lib/validacao/membros";

/**
 * Convite por link (D-030): gera o link, tenta enviar por e-mail e mostra o
 * link com o botão de copiar (para mandar por WhatsApp, por exemplo). O link
 * aparece só agora: o banco guarda apenas o hash do token.
 */
export function FormularioDeConvite() {
  const [convite, setConvite] = useState<ResultadoDoConvite | null>(null);
  const refFormulario = useRef<HTMLFormElement>(null);
  const refResultado = useRef<HTMLDivElement>(null);

  const { aoEnviar, erros, erroGeral, pendente, refResumo } = useFormulario({
    esquema: esquemaConvite,
    enviar: async (_dados, brutos) => {
      setConvite(null);
      const resultado = await convidarAcao(brutos);
      if (!resultado.ok) {
        return resultado;
      }
      setConvite(resultado.dados);
      refFormulario.current?.reset();
      return { ok: true };
    },
  });

  // O resultado aparece abaixo do formulário: o foco vai até ele.
  useEffect(() => {
    if (convite) {
      refResultado.current?.focus();
    }
  }, [convite]);

  return (
    <div className="flex flex-col gap-4">
      <form ref={refFormulario} noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
        <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
        <CampoTexto
          id="email"
          rotulo="E-mail da pessoa"
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          ajuda="O link só vale para quem entrar com este e-mail."
          erro={erros.email}
        />
        <Botao type="submit" carregando={pendente}>
          <UserPlus aria-hidden="true" className="size-4" />
          Gerar convite
        </Botao>
      </form>

      {convite && (
        <div
          ref={refResultado}
          tabIndex={-1}
          className="flex flex-col gap-3 rounded-md border border-borda bg-superficie-2 p-4 text-sm outline-none"
        >
          <p className="flex items-start gap-2 font-semibold">
            {convite.emailEnviado ? (
              <MailCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sucesso" />
            ) : (
              <MailWarning aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-erro" />
            )}
            <span>
              Convite criado para <span className="break-all">{convite.email}</span>.
            </span>
          </p>
          <p className="text-texto-suave">
            {convite.emailEnviado
              ? "Enviamos o link por e-mail. Se preferir, copie e mande por outro canal:"
              : "Não conseguimos enviar o e-mail. Copie o link e mande para a pessoa:"}
          </p>
          <label htmlFor="link-do-convite" className="sr-only">
            Link do convite
          </label>
          <input
            id="link-do-convite"
            readOnly
            value={convite.link}
            onFocus={(evento) => evento.currentTarget.select()}
            className="h-controle w-full rounded-md border border-borda-campo bg-superficie px-3 font-mono text-xs"
          />
          <BotaoCopiar texto={convite.link} rotulo="Copiar link" />
          <p className="text-xs text-texto-suave">
            Vale até {formatarData(new Date(convite.expiraEm))}. Depois de usado, o link deixa de
            funcionar.
          </p>
        </div>
      )}
    </div>
  );
}
