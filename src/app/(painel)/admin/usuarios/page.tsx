import { UsersRound } from "lucide-react";
import type { Metadata } from "next";

import { Cabecalho } from "@/components/painel/Cabecalho";
import { EstadoVazio } from "@/components/ui/Avisos";
import { exigirPermissao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Usuários" };

/** Somente admin e suporte (matriz RBAC); para os demais, a página não existe (404). */
export default async function PaginaUsuarios() {
  await exigirPermissao("usuarios:listar");

  return (
    <>
      <Cabecalho titulo="Usuários" descricao="Administração da plataforma" />
      <EstadoVazio
        icone={<UsersRound aria-hidden="true" />}
        titulo="Em construção"
        descricao="Lista de usuários da plataforma e das empresas, com filtros e exportação."
      />
    </>
  );
}
