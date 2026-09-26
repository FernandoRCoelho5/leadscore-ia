import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

import { Cabecalho } from "@/components/painel/Cabecalho";
import { EstadoVazio } from "@/components/ui/Avisos";
import { exigirPermissao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Auditoria" };

/** Somente admin e suporte (matriz RBAC); para os demais, a página não existe (404). */
export default async function PaginaAuditoria() {
  await exigirPermissao("auditoria:ver");

  return (
    <>
      <Cabecalho titulo="Auditoria" descricao="Administração da plataforma" />
      <EstadoVazio
        icone={<ScrollText aria-hidden="true" />}
        titulo="Em construção"
        descricao="Registro de ações sensíveis: logins, exportações, exclusões e anonimizações."
      />
    </>
  );
}
