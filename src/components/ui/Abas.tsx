"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type Aba = { id: string; titulo: string; conteudo: ReactNode };

/**
 * Abas acessíveis (padrão WAI-ARIA): setas, Home e End trocam de aba; só a
 * aba ativa entra na ordem do Tab. O indicador desliza até a aba escolhida
 * (transform, `--curva-brasa`) e o painel entra com `animate-entrar`.
 */
export function Abas({ rotulo, abas }: { rotulo: string; abas: readonly Aba[] }) {
  const prefixo = useId();
  const [ativa, setAtiva] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicador, setIndicador] = useState({ x: 0, largura: 0 });

  useLayoutEffect(() => {
    const atual = refs.current[ativa];
    if (atual) {
      setIndicador({ x: atual.offsetLeft, largura: atual.offsetWidth });
    }
  }, [ativa]);

  function escolher(indice: number) {
    const total = abas.length;
    const proxima = (indice + total) % total;
    setAtiva(proxima);
    refs.current[proxima]?.focus();
  }

  function aoTeclar(evento: KeyboardEvent) {
    const acoes: Record<string, () => void> = {
      ArrowRight: () => escolher(ativa + 1),
      ArrowLeft: () => escolher(ativa - 1),
      Home: () => escolher(0),
      End: () => escolher(abas.length - 1),
    };
    const acao = acoes[evento.key];
    if (acao) {
      evento.preventDefault();
      acao();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={rotulo}
        onKeyDown={aoTeclar}
        className="relative flex gap-1 overflow-x-auto border-b border-borda"
      >
        {abas.map((aba, indice) => (
          <button
            key={aba.id}
            ref={(elemento) => {
              refs.current[indice] = elemento;
            }}
            type="button"
            role="tab"
            id={`${prefixo}-aba-${aba.id}`}
            aria-selected={indice === ativa}
            aria-controls={`${prefixo}-painel-${aba.id}`}
            tabIndex={indice === ativa ? 0 : -1}
            onClick={() => setAtiva(indice)}
            className="h-controle shrink-0 cursor-pointer rounded-t-md px-4 text-sm font-medium whitespace-nowrap text-texto-suave transition-colors hover:text-texto aria-selected:font-semibold aria-selected:text-marca-texto"
          >
            {aba.titulo}
          </button>
        ))}
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-0.5 rounded-full bg-primaria transition-transform duration-(--mov-padrao) ease-brasa"
          style={{ width: indicador.largura, transform: `translateX(${indicador.x}px)` }}
        />
      </div>
      {abas.map((aba, indice) => (
        <div
          key={aba.id}
          role="tabpanel"
          id={`${prefixo}-painel-${aba.id}`}
          aria-labelledby={`${prefixo}-aba-${aba.id}`}
          hidden={indice !== ativa}
          tabIndex={0}
          className="animate-entrar rounded-md"
        >
          {aba.conteudo}
        </div>
      ))}
    </div>
  );
}
