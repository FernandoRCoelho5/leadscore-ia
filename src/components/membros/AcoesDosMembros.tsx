"use client";

import { UserMinus, X } from "lucide-react";
import { useState, useTransition } from "react";

import { cancelarConviteAcao, removerMembroAcao } from "@/app/(painel)/membros/acoes";
import { Alerta } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { DialogoDeConfirmacao } from "@/components/ui/DialogoDeConfirmacao";

/**
 * Remover alguém da empresa pede confirmação (a pessoa perde o acesso na
 * hora); cancelar um convite não pede, porque basta convidar de novo.
 */
export function RemoverMembro({ usuarioId, nome }: { usuarioId: string; nome: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <DialogoDeConfirmacao
      rotuloDoGatilho="Remover"
      complementoDoGatilho={nome}
      iconeDoGatilho={<UserMinus aria-hidden="true" className="size-4" />}
      gatilhoCompacto
      titulo={`Remover ${nome} da empresa?`}
      rotuloDeConfirmar="Remover"
      pendente={pendente}
      aoConfirmar={() =>
        new Promise<boolean>((resolver) => {
          iniciar(async () => {
            const resultado = await removerMembroAcao(usuarioId);
            setErro(resultado.ok ? null : resultado.erro.mensagem);
            resolver(resultado.ok);
          });
        })
      }
    >
      <p>
        A pessoa perde o acesso aos leads da empresa na hora. A conta dela continua existindo, e dá
        para convidá-la de novo depois.
      </p>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
    </DialogoDeConfirmacao>
  );
}

export function CancelarConvite({ conviteId, email }: { conviteId: string; email: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <Botao
        variante="contorno"
        carregando={pendente}
        onClick={() =>
          iniciar(async () => {
            const resultado = await cancelarConviteAcao(conviteId);
            setErro(resultado.ok ? null : resultado.erro.mensagem);
          })
        }
      >
        {!pendente && <X aria-hidden="true" className="size-4" />}
        Cancelar
        <span className="sr-only"> o convite de {email}</span>
      </Botao>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
    </div>
  );
}
