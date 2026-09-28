"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { classesDeBotao } from "./Botao";

/**
 * Janela modal com o <dialog> nativo: prende o foco, fecha com Esc ou no X e
 * devolve o foco ao botão que a abriu. Para ações destrutivas, use
 * `DialogoDeConfirmacao`.
 */
export function Dialogo({
  rotuloDoGatilho,
  complementoDoGatilho,
  iconeDoGatilho,
  titulo,
  descricao,
  aoFechar,
  children,
}: {
  rotuloDoGatilho: string;
  /** Texto só para leitores de tela, quando há um gatilho por linha ("Gerenciar" + "Agência X"). */
  complementoDoGatilho?: string;
  iconeDoGatilho?: ReactNode;
  titulo: string;
  descricao?: ReactNode;
  /** Chamado ao fechar (ex.: limpar avisos para a próxima abertura). */
  aoFechar?: () => void;
  children: ReactNode;
}) {
  const refDialogo = useRef<HTMLDialogElement>(null);
  const idDoTitulo = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => refDialogo.current?.showModal()}
        className={classesDeBotao("contorno")}
      >
        {iconeDoGatilho}
        {rotuloDoGatilho}
        {complementoDoGatilho && <span className="sr-only"> {complementoDoGatilho}</span>}
      </button>
      <dialog
        ref={refDialogo}
        aria-labelledby={idDoTitulo}
        onClose={aoFechar}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-borda bg-superficie p-0 text-texto shadow-lg backdrop:bg-carvao-950/50"
      >
        <div className="flex items-start justify-between gap-4 border-b border-borda px-6 py-4">
          <div className="min-w-0">
            <h2 id={idDoTitulo} className="text-lg font-semibold">
              {titulo}
            </h2>
            {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
          </div>
          <button
            type="button"
            onClick={() => refDialogo.current?.close()}
            aria-label="Fechar"
            className="-mr-2 flex size-controle shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-superficie-2"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="flex flex-col gap-6 px-6 py-5">{children}</div>
      </dialog>
    </>
  );
}
