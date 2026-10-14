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
    // Em cartão estreito (celular, coluna do catálogo), o botão desce e ocupa
    // a largura toda; dividindo a linha, ele espremia o texto numa coluna de
    // uma palavra. A regra olha a largura do cartão (@container), não da tela.
    <Cartao quente className="@container">
      <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
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
              {um ? "Ele ainda está" : "Eles ainda estão"} no andamento &quot;Novo&quot;. Quem
              responde primeiro tem mais chance de fechar.
            </p>
          </div>
        </div>
        <Link
          href={urlComFiltros("/leads", { classificacao: "quente", status: "novo" })}
          className={`${classesDeBotao("primaria")} w-full shrink-0 @lg:w-auto`}
        >
          <MessageSquareReply aria-hidden="true" className="size-4" />
          Responder agora
        </Link>
      </div>
    </Cartao>
  );
}
