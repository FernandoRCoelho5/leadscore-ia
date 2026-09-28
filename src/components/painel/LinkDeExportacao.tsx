import { Download } from "lucide-react";

import { classesDeBotao } from "@/components/ui/Botao";

/**
 * "Exportar CSV" das listas: um link comum para a rota de exportação, com os
 * mesmos filtros da tela. O navegador baixa o arquivo sem sair da página.
 */
export function LinkDeExportacao({ href }: { href: string }) {
  return (
    <a href={href} download className={classesDeBotao("contorno")}>
      <Download aria-hidden="true" className="size-4" />
      Exportar CSV
    </a>
  );
}
