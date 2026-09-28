"use client";

import { useId, useRef, type ReactNode } from "react";

import { Botao } from "./Botao";

/**
 * Confirmação de ação destrutiva com o <dialog> nativo em modo modal: prende o
 * foco, fecha com Esc e devolve o foco ao botão que o abriu. O botão de
 * confirmar é o do formulário de dentro, então a ação só roda por escolha
 * explícita.
 */
export function DialogoDeConfirmacao({
  rotuloDoGatilho,
  complementoDoGatilho,
  iconeDoGatilho,
  gatilhoCompacto = false,
  titulo,
  children,
  rotuloDeConfirmar,
  aoConfirmar,
  pendente,
  confirmarDesabilitado = false,
}: {
  rotuloDoGatilho: string;
  /** Texto só para leitores de tela, quando há um gatilho por linha ("Bloquear" + "Maria"). */
  complementoDoGatilho?: string;
  iconeDoGatilho?: ReactNode;
  /** Botão do tamanho do texto (em tabelas), em vez de ocupar a largura toda. */
  gatilhoCompacto?: boolean;
  titulo: string;
  children: ReactNode;
  rotuloDeConfirmar: string;
  /** Devolve `true` para fechar o diálogo (ação concluída). */
  aoConfirmar: () => Promise<boolean>;
  pendente: boolean;
  confirmarDesabilitado?: boolean;
}) {
  const refDialogo = useRef<HTMLDialogElement>(null);
  // useId: com um diálogo por linha de uma tabela, os ids não se repetem.
  const idDoTitulo = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => refDialogo.current?.showModal()}
        className={`inline-flex h-controle cursor-pointer items-center gap-2 rounded-md border border-erro/40 bg-superficie text-sm font-semibold text-erro transition-colors duration-150 hover:bg-erro-fundo ${gatilhoCompacto ? "px-3" : "w-full px-4"}`}
      >
        {iconeDoGatilho}
        {rotuloDoGatilho}
        {complementoDoGatilho && <span className="sr-only"> {complementoDoGatilho}</span>}
      </button>
      <dialog
        ref={refDialogo}
        aria-labelledby={idDoTitulo}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border border-borda bg-superficie p-0 text-texto shadow-lg backdrop:bg-carvao-950/50"
      >
        <form
          onSubmit={async (evento) => {
            evento.preventDefault();
            if (await aoConfirmar()) {
              refDialogo.current?.close();
            }
          }}
          className="flex flex-col gap-4 p-6"
        >
          <h2 id={idDoTitulo} className="text-lg font-semibold">
            {titulo}
          </h2>
          <div className="flex flex-col gap-3 text-sm text-texto-suave">{children}</div>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Botao variante="contorno" onClick={() => refDialogo.current?.close()}>
              Cancelar
            </Botao>
            <Botao
              type="submit"
              variante="destrutivo"
              carregando={pendente}
              disabled={confirmarDesabilitado}
            >
              {rotuloDeConfirmar}
            </Botao>
          </div>
        </form>
      </dialog>
    </>
  );
}
