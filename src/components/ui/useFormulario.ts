"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type { z } from "zod";

import type { DetalheDeCampo } from "@/lib/erros";

/** Resposta de quem processa o formulário (Server Action ou cliente de autenticação). */
export type ResultadoDoEnvio =
  { ok: true } | { ok: false; erro: { mensagem: string; detalhes?: readonly DetalheDeCampo[] } };

/**
 * Estado padrão dos formulários da Brasa:
 * 1. valida no navegador com o mesmo schema Zod do servidor (resposta imediata);
 * 2. envia e mostra os erros devolvidos pelo servidor, campo a campo;
 * 3. em caso de falha, leva o foco ao resumo de erros (leitores de tela anunciam).
 *
 * Os valores digitados são preservados quando algo dá errado.
 */
export function useFormulario<Esquema extends z.ZodType>({
  esquema,
  enviar,
}: {
  esquema: Esquema;
  /** Recebe os dados já validados e os valores brutos (texto), que Server Actions revalidam. */
  enviar: (
    dados: z.output<Esquema>,
    brutos: Record<string, string>,
  ) => Promise<ResultadoDoEnvio | void>;
}) {
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [falhas, setFalhas] = useState(0);
  const [sucesso, setSucesso] = useState(false);
  const [pendente, iniciar] = useTransition();
  const refResumo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (falhas > 0) {
      refResumo.current?.focus();
    }
  }, [falhas]);

  function mostrarErros(mensagem: string | null, detalhes: readonly DetalheDeCampo[]) {
    const porCampo: Record<string, string> = {};
    for (const { campo, mensagem: texto } of detalhes) {
      porCampo[campo] ??= texto;
    }
    setErros(porCampo);
    setErroGeral(mensagem);
    setFalhas((atual) => atual + 1);
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSucesso(false);
    const valores: Record<string, string> = {};
    for (const [campo, valor] of new FormData(evento.currentTarget)) {
      if (typeof valor === "string") {
        valores[campo] = valor;
      }
    }
    const validacao = esquema.safeParse(valores);
    if (!validacao.success) {
      mostrarErros(
        null,
        validacao.error.issues.map((issue) => ({
          campo: issue.path.map(String).join("."),
          mensagem: issue.message,
        })),
      );
      return;
    }

    iniciar(async () => {
      const resultado = await enviar(validacao.data, valores);
      if (resultado && !resultado.ok) {
        mostrarErros(resultado.erro.mensagem, resultado.erro.detalhes ?? []);
      } else {
        setErros({});
        setErroGeral(null);
        setSucesso(true);
      }
    });
  }

  return { aoEnviar, erros, erroGeral, pendente, sucesso, refResumo };
}
