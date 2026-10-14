"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type TipoDeToast = "sucesso" | "erro" | "info";
type Toast = { id: number; tipo: TipoDeToast; mensagem: string; saindo: boolean };

/** Quanto um aviso de sucesso ou informação fica na tela (pausa com o mouse ou o foco). */
export const DURACAO_DO_TOAST_MS = 6000;
/** Igual à animação `animate-sair` (--mov-enfatico × 0,6). */
const DURACAO_DA_SAIDA_MS = 260;

const ContextoDosToasts = createContext<((tipo: TipoDeToast, mensagem: string) => void) | null>(
  null,
);

/**
 * Avisos passageiros ("Resposta copiada", "Lead salvo"). Ficam numa região
 * `aria-live` que existe desde o início, para os leitores de tela anunciarem.
 * Erros não somem sozinhos (quem lê devagar precisa de tempo, WCAG 2.2.1);
 * os demais somem em 6 s, com pausa enquanto o mouse ou o foco estão neles.
 */
export function ProvedorDeToasts({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const proximoId = useRef(0);

  const fechar = useCallback((id: number) => {
    setToasts((lista) => lista.map((t) => (t.id === id ? { ...t, saindo: true } : t)));
    setTimeout(() => setToasts((lista) => lista.filter((t) => t.id !== id)), DURACAO_DA_SAIDA_MS);
  }, []);

  const avisar = useCallback((tipo: TipoDeToast, mensagem: string) => {
    proximoId.current += 1;
    const id = proximoId.current;
    // No máximo 3 na tela: o mais antigo sai.
    setToasts((lista) => [...lista.slice(-2), { id, tipo, mensagem, saindo: false }]);
  }, []);

  return (
    <ContextoDosToasts.Provider value={avisar}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((toast) => (
          <ItemDeToast key={toast.id} toast={toast} aoFechar={() => fechar(toast.id)} />
        ))}
      </div>
    </ContextoDosToasts.Provider>
  );
}

export function useToasts() {
  const avisar = useContext(ContextoDosToasts);
  if (!avisar) {
    throw new Error("useToasts precisa estar dentro de <ProvedorDeToasts>.");
  }
  return { avisar };
}

const APARENCIA: Record<TipoDeToast, { Icone: typeof Info; cor: string }> = {
  sucesso: { Icone: CircleCheck, cor: "text-sucesso" },
  erro: { Icone: CircleAlert, cor: "text-erro" },
  info: { Icone: Info, cor: "text-marca-texto" },
};

function ItemDeToast({ toast, aoFechar }: { toast: Toast; aoFechar: () => void }) {
  const [pausado, setPausado] = useState(false);
  const { Icone, cor } = APARENCIA[toast.tipo];

  useEffect(() => {
    if (toast.tipo === "erro" || pausado || toast.saindo) {
      return;
    }
    const temporizador = setTimeout(aoFechar, DURACAO_DO_TOAST_MS);
    return () => clearTimeout(temporizador);
  }, [toast.tipo, toast.saindo, pausado, aoFechar]);

  return (
    <div
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-borda bg-superficie p-4 text-sm text-texto shadow-lg ${
        toast.saindo ? "animate-sair" : "animate-entrar"
      }`}
    >
      <Icone aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${cor}`} />
      <p className="min-w-0 flex-1">{toast.mensagem}</p>
      <button
        type="button"
        onClick={aoFechar}
        aria-label="Fechar aviso"
        className="-m-2 flex size-controle shrink-0 cursor-pointer items-center justify-center rounded-md text-texto-suave hover:bg-superficie-2 hover:text-texto"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
