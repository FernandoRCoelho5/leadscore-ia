import { notFound } from "next/navigation";

import { db } from "@/db";
import { contextoDa, exigirPermissaoNaEmpresa } from "@/server/auth/sessao";
import { leadEstaNaEmpresa } from "@/server/services/leads";

/**
 * Antes do esqueleto do detalhe, confere se o lead existe na empresa ativa:
 * o lead de outra empresa (ou um id inventado) recebe um 404 de verdade, sem
 * revelar se existe (D-038). Só confere o id; os dados e a auditoria ficam
 * na página.
 */
export default async function Layout({ children, params }: LayoutProps<"/leads/[id]">) {
  const sessao = await exigirPermissaoNaEmpresa("leads:ver");
  const { id } = await params;
  if (!(await leadEstaNaEmpresa(db, contextoDa(sessao), sessao.empresaAtiva.empresaId, id))) {
    notFound();
  }
  return children;
}
