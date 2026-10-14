import { Flame, MessageSquareReply } from "lucide-react";
import Link from "next/link";

import { classesDeBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { urlComFiltros } from "@/lib/validacao/filtros";

/**
 * Destaque do que pede ação agora (D-036): quentes que ninguém respondeu.
 * É o único brilho que respira e a única chama viva da tela, para não
 * disputarem atenção.
 */
export function QuentesSemResposta({ quantidade }: { quantidade: number }) {
  const um = quantidade === 1;
  return (
    <Cartao quente className="flex flex-wrap items-center gap-4">
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-quente-fundo text-quente-icone"
      >
        <Flame className="size-6 origin-[50%_90%] animate-chama" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">
          {quantidade.toLocaleString("pt-BR")}{" "}
          {um ? "lead quente esperando resposta" : "leads quentes esperando resposta"}
        </h2>
        <p className="text-sm text-texto-suave">
          {um ? "Ele ainda está" : "Eles ainda estão"} no andamento &quot;Novo&quot;. Quem responde
          primeiro tem mais chance de fechar.
        </p>
      </div>
      <Link
        href={urlComFiltros("/leads", { classificacao: "quente", status: "novo" })}
        className={classesDeBotao("primaria")}
      >
        <MessageSquareReply aria-hidden="true" className="size-4" />
        Responder agora
      </Link>
    </Cartao>
  );
}
