import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { Cabecalho } from "@/components/painel/Cabecalho";
import { EstadoVazio } from "@/components/ui/Avisos";
import { exigirPermissao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Empresas" };

/** Somente admin e suporte (matriz RBAC); para os demais, a página não existe (404). */
export default async function PaginaEmpresas() {
  await exigirPermissao("empresas:listar");

  return (
    <>
      <Cabecalho titulo="Empresas" descricao="Administração da plataforma" />
      <EstadoVazio
        icone={<Building2 aria-hidden="true" />}
        titulo="Em construção"
        descricao="Lista de empresas clientes com filtros, paginação, bloqueio e ajuste do limite mensal."
      />
    </>
  );
}
