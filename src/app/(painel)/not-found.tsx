import { SearchX } from "lucide-react";
import Link from "next/link";

import { classesDeBotao } from "@/components/ui/Botao";
import { Moldura } from "@/components/ui/TelaDeErro";

/**
 * "Não encontrado" dentro do painel, com o menu: vale para registro de outra
 * empresa e para página sem permissão (que responde 404 para não revelar que
 * existe).
 */
export default function NaoEncontradaNoPainel() {
  return (
    <Moldura
      icone={<SearchX aria-hidden="true" />}
      titulo="Página não encontrada"
      descricao="O que você procura não existe ou não está disponível para o seu perfil."
    >
      <Link href="/painel" className={classesDeBotao("contorno")}>
        Ir para a visão geral
      </Link>
    </Moldura>
  );
}
