import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { classesDeBotao } from "@/components/ui/Botao";
import { Moldura } from "@/components/ui/TelaDeErro";

export const metadata: Metadata = { title: "Página não encontrada" };

/** Endereço que não existe (fora do painel). */
export default function NaoEncontrada() {
  return (
    <main id="conteudo" className="flex flex-1 flex-col">
      <Moldura
        icone={<SearchX aria-hidden="true" />}
        titulo="Página não encontrada"
        descricao="O endereço pode estar incompleto ou a página não existe mais."
      >
        <Link href="/" className={classesDeBotao("contorno")}>
          Voltar para o início
        </Link>
      </Moldura>
    </main>
  );
}
