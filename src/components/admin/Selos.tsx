import { Ban, Building2, CircleCheck, Headset, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { ROTULO_DO_PAPEL, type PapelDeAcesso } from "@/lib/rotulos";

/**
 * Selos das listas da administração: sempre ícone e texto, nunca só a cor
 * (quem não distingue verde de vermelho lê a palavra).
 */

const SELO =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:size-3.5";

export function SeloDeSituacao({ bloqueado, rotulo }: { bloqueado: boolean; rotulo: string }) {
  return (
    <span
      className={`${SELO} ${bloqueado ? "bg-erro-fundo text-erro-alerta" : "bg-sucesso-fundo text-sucesso"}`}
    >
      {bloqueado ? <Ban aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
      {rotulo}
    </span>
  );
}

const ICONE_DO_PAPEL: Record<PapelDeAcesso, ReactNode> = {
  admin: <ShieldCheck aria-hidden="true" />,
  suporte: <Headset aria-hidden="true" />,
  cliente: <Building2 aria-hidden="true" />,
};

export function SeloDoPapel({ papel }: { papel: PapelDeAcesso }) {
  return (
    <span
      className={`${SELO} ${papel === "cliente" ? "bg-superficie-2 text-texto-suave" : "bg-secundaria text-texto-secundaria"}`}
    >
      {ICONE_DO_PAPEL[papel]}
      {ROTULO_DO_PAPEL[papel]}
    </span>
  );
}
