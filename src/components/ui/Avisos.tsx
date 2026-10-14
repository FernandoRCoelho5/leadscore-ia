import { CircleAlert, CircleCheck, CloudAlert } from "lucide-react";
import Image from "next/image";
import type { ReactNode, Ref } from "react";

/** Alerta de sucesso ou erro, sempre com ícone e texto (nunca só a cor). */
export function Alerta({ tipo, children }: { tipo: "erro" | "sucesso"; children: ReactNode }) {
  const Icone = tipo === "erro" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`flex animate-entrar items-start gap-2 rounded-md px-3 py-2.5 text-sm ${
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
      className="animate-entrar rounded-md bg-erro-fundo px-3 py-2.5 text-sm text-erro-alerta"
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

/**
 * Tela sem dados: explica o que vai aparecer ali e oferece o próximo passo.
 * O ícone fica numa "brasa" (círculo quente com anéis), convidando à ação.
 */
export function EstadoVazio({ icone, titulo, descricao, acao }: PropsDoEstadoVazio) {
  return (
    <div className="flex animate-entrar flex-col items-center gap-3 rounded-lg border border-dashed border-borda bg-superficie px-6 py-12 text-center">
      <IconeEmBrasa tom="quente">{icone}</IconeEmBrasa>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="max-w-md text-sm text-texto-suave">{descricao}</p>
      {acao}
    </div>
  );
}

/**
 * Parte da tela que não carregou (o resto continua funcionando). Diz o que
 * aconteceu e como resolver; a mensagem técnica nunca aparece.
 */
export function EstadoDeErro({
  titulo = "Não conseguimos carregar esta parte",
  descricao = "Tente de novo em alguns segundos. Se continuar, fale com o suporte da Brasa.",
  acao,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex animate-entrar flex-col items-center gap-3 rounded-lg border border-borda bg-superficie px-6 py-10 text-center"
    >
      <IconeEmBrasa tom="erro">
        <CloudAlert aria-hidden="true" />
      </IconeEmBrasa>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="max-w-md text-sm text-texto-suave">{descricao}</p>
      {acao}
    </div>
  );
}

/** Ícone decorativo num círculo com dois anéis (estados vazios e de erro). */
function IconeEmBrasa({ tom, children }: { tom: "quente" | "erro"; children: ReactNode }) {
  const cores =
    tom === "quente"
      ? "bg-quente-fundo text-quente-icone ring-quente-fundo/60"
      : "bg-erro-fundo text-erro ring-erro-fundo/60";
  return (
    <div
      aria-hidden="true"
      className={`flex size-14 items-center justify-center rounded-full ring-8 [&>svg]:size-6 ${cores}`}
    >
      {children}
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
