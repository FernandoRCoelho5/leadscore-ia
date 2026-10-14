"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type { z } from "zod";

import type { DetalheDeCampo } from "@/lib/erros";

/**
 * O esquema pode vir pronto ou sob demanda (`() => import(...)`): assim o Zod,
 * o maior pacote do navegador, não entra no primeiro carregamento da página
 * (D-040). Declare a função fora do componente, para ela ser sempre a mesma.
 */
export type FonteDoEsquema<Esquema extends z.ZodType> = Esquema | (() => Promise<Esquema>);

/** Esquemas já baixados, por função de carga: cada um é baixado uma vez só. */
const esquemasBaixados = new WeakMap<() => Promise<z.ZodType>, Promise<z.ZodType>>();

export function obterEsquema<Esquema extends z.ZodType>(
  fonte: FonteDoEsquema<Esquema>,
): Promise<Esquema> {
  if (typeof fonte !== "function") {
    return Promise.resolve(fonte);
  }
  let promessa = esquemasBaixados.get(fonte);
  if (!promessa) {
    promessa = fonte();
    esquemasBaixados.set(fonte, promessa);
    // Sem rede, a próxima tentativa baixa de novo.
    promessa.catch(() => esquemasBaixados.delete(fonte));
  }
  return promessa as Promise<Esquema>;
}

/**
 * Começa a baixar o esquema no primeiro sinal de uso da página (foco, toque
 * ou tecla): quem vai preencher leva alguns segundos digitando, e o esquema
 * chega antes do envio. Assim ele não disputa a rede com o carregamento da
 * página (no pior caso, o envio espera o download).
 */
export function useEsquemaAntecipado<Esquema extends z.ZodType>(fonte: FonteDoEsquema<Esquema>) {
  useEffect(() => {
    const eventos = ["focusin", "pointerdown", "keydown"] as const;
    const baixar = () => {
      for (const evento of eventos) {
        document.removeEventListener(evento, baixar, true);
      }
      void obterEsquema(fonte).catch(() => undefined);
    };
    for (const evento of eventos) {
      document.addEventListener(evento, baixar, true);
    }
    return () => {
      for (const evento of eventos) {
        document.removeEventListener(evento, baixar, true);
      }
    };
  }, [fonte]);
}

const SEM_CONEXAO =
  "Não foi possível conferir os dados agora. Verifique a conexão e tente de novo.";

/** Resposta de quem processa o formulário (Server Action ou cliente de autenticação). */
export type ResultadoDoEnvio =
  { ok: true } | { ok: false; erro: { mensagem: string; detalhes?: readonly DetalheDeCampo[] } };

/**
 * Estado padrão dos formulários da Brasa:
 * 1. valida no navegador com o mesmo schema Zod do servidor (resposta imediata),
 *    baixado sob demanda (`FonteDoEsquema`);
 * 2. envia e mostra os erros devolvidos pelo servidor, campo a campo;
 * 3. em caso de falha, leva o foco ao resumo de erros (leitores de tela anunciam).
 *
 * Os valores digitados são preservados quando algo dá errado.
 */
export function useFormulario<Esquema extends z.ZodType>({
  esquema,
  enviar,
}: {
  esquema: FonteDoEsquema<Esquema>;
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
  useEsquemaAntecipado(esquema);

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

    iniciar(async () => {
      let validador: Esquema;
      try {
        validador = await obterEsquema(esquema);
      } catch {
        mostrarErros(SEM_CONEXAO, []);
        return;
      }
      const validacao = validador.safeParse(valores);
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
