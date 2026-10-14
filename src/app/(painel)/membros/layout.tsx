import type { ReactNode } from "react";

import { exigirPermissaoNaEmpresa } from "@/server/auth/sessao";

/**
 * Confere a permissão antes do esqueleto (loading.tsx): quem não pode ver
 * recebe um 404 de verdade, porque depois que a página começa a ser enviada o
 * status não muda mais (D-038). A página confere de novo; a segurança não
 * depende deste layout.
 */
export default async function Layout({ children }: { children: ReactNode }) {
  await exigirPermissaoNaEmpresa("membros:ver");
  return children;
}
