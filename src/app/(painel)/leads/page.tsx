import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Cabecalho } from "@/components/painel/Cabecalho";
import { EstadoVazio } from "@/components/ui/Avisos";
import { exigirPermissao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Leads" };

export default async function PaginaLeads() {
  const sessao = await exigirPermissao("leads:ver");
  if (!sessao.empresaAtiva) {
    notFound();
  }

  return (
    <>
      <Cabecalho titulo="Leads" descricao={sessao.empresaAtiva.nome} />
      <EstadoVazio
        icone={<Inbox aria-hidden="true" />}
        titulo="Nenhum lead ainda"
        descricao="Aqui você vai buscar, filtrar por classificação e status, e exportar seus leads em CSV."
      />
    </>
  );
}
