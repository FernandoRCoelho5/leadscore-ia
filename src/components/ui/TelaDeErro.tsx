import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

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
}: {
  codigo?: string;
  aoTentarDeNovo: () => void;
  destino?: { href: string; rotulo: string };
}) {
  return (
    <Moldura
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

/** Moldura comum às telas de erro e de "não encontrado". */
export function Moldura({
  icone,
  titulo,
  descricao,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-superficie-2 text-texto-suave [&>svg]:size-7">
        {icone}
      </span>
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="max-w-md text-texto-suave">{descricao}</p>
      {children}
    </div>
  );
}
