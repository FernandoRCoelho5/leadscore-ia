import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/marca/Logo";

import { Botao, classesDeBotao } from "./Botao";

/**
 * Tela de erro inesperado. O código (digest) é o mesmo do log do servidor:
 * quem pedir ajuda ao suporte informa o código, e a mensagem técnica nunca
 * aparece para o usuário (em produção o Next.js nem a envia ao navegador).
 */
export function TelaDeErro({
  codigo,
  aoTentarDeNovo,
  destino = { href: "/", rotulo: "Voltar para o início" },
  comLogo = false,
}: {
  codigo?: string;
  aoTentarDeNovo: () => void;
  destino?: { href: string; rotulo: string };
  /** Fora do painel (que já mostra a marca no menu), a tela traz o logotipo. */
  comLogo?: boolean;
}) {
  return (
    <Moldura
      tom="erro"
      comLogo={comLogo}
      icone={<TriangleAlert aria-hidden="true" />}
      titulo="Algo deu errado"
      descricao="Não conseguimos mostrar esta página agora. Tente de novo em alguns segundos; se continuar, fale com o suporte da Brasa."
    >
      {codigo && (
        <p className="text-xs text-texto-suave">
          Código do erro: <code className="font-mono">{codigo}</code>
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Botao onClick={aoTentarDeNovo}>Tentar de novo</Botao>
        <Link href={destino.href} className={classesDeBotao("contorno")}>
          {destino.rotulo}
        </Link>
      </div>
    </Moldura>
  );
}

/**
 * Moldura comum às telas de erro e de "não encontrado": o ícone numa "brasa"
 * (quente para "não encontrado", carmim para erro, nunca o laranja da marca em
 * alerta) e, fora do painel, o logotipo levando ao início.
 */
export function Moldura({
  icone,
  titulo,
  descricao,
  tom = "quente",
  comLogo = false,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  tom?: "quente" | "erro";
  comLogo?: boolean;
  children?: ReactNode;
}) {
  const cores =
    tom === "erro"
      ? "bg-erro-fundo text-erro ring-erro-fundo/50"
      : "bg-quente-fundo text-quente-icone ring-quente-fundo/50";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {comLogo && (
        <Link href="/" aria-label="Brasa, página inicial" className="mb-6 rounded-md">
          <Logo decorativo className="h-8 w-auto" />
        </Link>
      )}
      <span
        className={`flex size-16 animate-entrar items-center justify-center rounded-full ring-8 [&>svg]:size-7 ${cores}`}
      >
        {icone}
      </span>
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="max-w-md text-texto-suave">{descricao}</p>
      {children}
    </div>
  );
}
