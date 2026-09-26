import { CircleAlert } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/**
 * Campos de formulário acessíveis: rótulo visível acima (nunca só
 * placeholder), texto de ajuda e erro abaixo do campo, ligados a ele por
 * aria-describedby, e aria-invalid quando há erro.
 */

type PropsComuns = {
  id: string;
  rotulo: string;
  /** Marca o campo como "(opcional)" no rótulo. */
  opcional?: boolean;
  ajuda?: ReactNode;
  erro?: string;
};

const ESTILO_CAMPO =
  "w-full rounded-md border border-borda-campo bg-superficie px-3 text-base text-texto placeholder:text-texto-suave aria-invalid:border-erro aria-invalid:ring-1 aria-invalid:ring-erro";

function descritores(id: string, ajuda: unknown, erro: unknown): string | undefined {
  const ids = [ajuda ? `${id}-ajuda` : null, erro ? `${id}-erro` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function Rotulo({ id, rotulo, opcional }: Pick<PropsComuns, "id" | "rotulo" | "opcional">) {
  return (
    <label htmlFor={id} className="text-sm font-medium text-texto">
      {rotulo}
      {opcional && <span className="font-normal text-texto-suave"> (opcional)</span>}
    </label>
  );
}

export function AjudaEErro({ id, ajuda, erro }: Pick<PropsComuns, "id" | "ajuda" | "erro">) {
  return (
    <>
      {ajuda && (
        <p id={`${id}-ajuda`} className="text-sm text-texto-suave">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} className="flex items-start gap-1.5 text-sm text-erro">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}
    </>
  );
}

type PropsDoCampoTexto = PropsComuns & Omit<InputHTMLAttributes<HTMLInputElement>, "id">;

export function CampoTexto({
  id,
  rotulo,
  opcional,
  ajuda,
  erro,
  name,
  className = "",
  ...resto
}: PropsDoCampoTexto) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <input
        id={id}
        name={name ?? id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritores(id, ajuda, erro)}
        className={`h-controle ${ESTILO_CAMPO}`}
        {...resto}
      />
      <AjudaEErro id={id} ajuda={ajuda} erro={erro} />
    </div>
  );
}

type PropsDaAreaDeTexto = PropsComuns & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">;

export function AreaDeTexto({
  id,
  rotulo,
  opcional,
  ajuda,
  erro,
  name,
  rows = 4,
  className = "",
  ...resto
}: PropsDaAreaDeTexto) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Rotulo id={id} rotulo={rotulo} opcional={opcional} />
      <textarea
        id={id}
        name={name ?? id}
        rows={rows}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritores(id, ajuda, erro)}
        className={`py-2 ${ESTILO_CAMPO}`}
        {...resto}
      />
      <AjudaEErro id={id} ajuda={ajuda} erro={erro} />
    </div>
  );
}
