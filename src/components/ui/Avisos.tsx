import { CircleAlert, CircleCheck } from "lucide-react";
import Image from "next/image";
import type { ReactNode, Ref } from "react";

/** Alerta de sucesso ou erro, sempre com ícone e texto (nunca só a cor). */
export function Alerta({ tipo, children }: { tipo: "erro" | "sucesso"; children: ReactNode }) {
  const Icone = tipo === "erro" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-sm ${
        tipo === "erro" ? "bg-erro-fundo text-erro-alerta" : "bg-sucesso-fundo text-sucesso"
      }`}
    >
      <Icone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

type PropsDoResumo = {
  mensagem: string | null;
  /** Erros por campo (id do campo -> mensagem), com link para cada campo. */
  erros: Record<string, string>;
  refResumo: Ref<HTMLDivElement>;
};

/**
 * Resumo de erros no topo do formulário. Recebe o foco quando o envio falha,
 * e cada item leva ao campo com problema; os erros continuam também ao lado
 * de cada campo.
 */
export function ResumoDeErros({ mensagem, erros, refResumo }: PropsDoResumo) {
  const itens = Object.entries(erros);
  if (!mensagem && itens.length === 0) {
    return null;
  }
  return (
    <div
      ref={refResumo}
      tabIndex={-1}
      role="alert"
      className="rounded-md bg-erro-fundo px-3 py-2.5 text-sm text-erro-alerta"
    >
      <p className="flex items-center gap-2 font-semibold">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
        {mensagem ?? "Confira os campos destacados."}
      </p>
      {itens.length > 1 && (
        <ul className="mt-1.5 list-disc pl-10">
          {itens.map(([campo, erro]) => (
            <li key={campo}>
              <a href={`#${campo}`} className="underline underline-offset-2">
                {erro}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type PropsDoEstadoVazio = {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
};

/** Tela sem dados: explica o que vai aparecer ali e oferece o próximo passo. */
export function EstadoVazio({ icone, titulo, descricao, acao }: PropsDoEstadoVazio) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-borda bg-superficie px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-superficie-2 text-texto-suave [&>svg]:size-6">
        {icone}
      </div>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="max-w-md text-sm text-texto-suave">{descricao}</p>
      {acao}
    </div>
  );
}

/** Iniciais do nome para o avatar ("Maria da Silva" -> "MS"). */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}

type PropsDoAvatar = {
  nome: string;
  /** Rota autenticada da foto (ou prévia local "blob:"); sem ela, mostra as iniciais. */
  fotoUrl?: string | null;
  tamanho?: "md" | "lg";
};

/** Avatar com a foto ou as iniciais. Decorativo: o nome sempre aparece ao lado. */
export function Avatar({ nome, fotoUrl = null, tamanho = "md" }: PropsDoAvatar) {
  const lado = tamanho === "lg" ? 64 : 36;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secundaria font-semibold text-texto-secundaria ${
        tamanho === "lg" ? "size-16 text-xl" : "size-9 text-sm"
      }`}
    >
      {fotoUrl ? (
        // A foto exige a sessão de quem vê: o otimizador de imagens não a tem,
        // por isso `unoptimized` (ela já chega pequena, com até 512 px).
        <Image
          src={fotoUrl}
          alt=""
          width={lado}
          height={lado}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        iniciaisDe(nome)
      )}
    </span>
  );
}
