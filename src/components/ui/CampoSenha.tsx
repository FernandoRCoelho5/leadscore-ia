"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";

import { AjudaEErro, Rotulo } from "./Campo";

type PropsDoCampoSenha = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id: string;
  rotulo: string;
  ajuda?: ReactNode;
  erro?: string;
  /** "current-password" no login; "new-password" no cadastro e na troca de senha. */
  autoComplete: "current-password" | "new-password";
};

/**
 * Campo de senha com botão para mostrar ou ocultar o que foi digitado.
 * Colar é permitido e o autocomplete ajuda os gerenciadores de senha
 * (autenticação acessível, WCAG 2.2).
 */
export function CampoSenha({ id, rotulo, ajuda, erro, name, ...resto }: PropsDoCampoSenha) {
  const [visivel, setVisivel] = useState(false);
  const descritores = [ajuda ? `${id}-ajuda` : null, erro ? `${id}-erro` : null].filter(Boolean);

  return (
    <div className="flex flex-col gap-1.5">
      <Rotulo id={id} rotulo={rotulo} />
      <div className="relative">
        <input
          id={id}
          name={name ?? id}
          type={visivel ? "text" : "password"}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descritores.length > 0 ? descritores.join(" ") : undefined}
          className="h-controle w-full rounded-md border border-borda-campo bg-superficie pr-12 pl-3 text-base text-texto aria-invalid:border-erro aria-invalid:ring-1 aria-invalid:ring-erro"
          {...resto}
        />
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          aria-controls={id}
          aria-pressed={visivel}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-md text-texto-suave hover:text-texto"
        >
          {visivel ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>
      <AjudaEErro id={id} ajuda={ajuda} erro={erro} />
    </div>
  );
}
