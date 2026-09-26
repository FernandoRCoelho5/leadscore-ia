import type { ReactNode } from "react";

import { EstruturaDoPainel } from "@/components/layout/EstruturaDoPainel";
import { exigirSessaoComEmpresa } from "@/server/auth/sessao";

/** Área logada: exige sessão válida (e empresa, para clientes) em todas as páginas do grupo. */
export default async function LayoutDoPainel({ children }: { children: ReactNode }) {
  const sessao = await exigirSessaoComEmpresa();
  return <EstruturaDoPainel sessao={sessao}>{children}</EstruturaDoPainel>;
}
