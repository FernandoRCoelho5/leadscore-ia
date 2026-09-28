"use client";

import { Ban, LockOpen } from "lucide-react";
import { useState, useTransition } from "react";

import { alterarBloqueioDoUsuarioAcao } from "@/app/(painel)/admin/acoes";
import { Alerta } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { DialogoDeConfirmacao } from "@/components/ui/DialogoDeConfirmacao";

/**
 * Bloquear (com confirmação: a pessoa perde o acesso na hora) ou desbloquear
 * (direto: não tira nada de ninguém). Só aparece para o admin, e nunca na
 * própria linha; o serviço confere as duas regras de novo.
 */
export function BloqueioDoUsuario({
  usuario,
}: {
  usuario: { id: string; nome: string; bloqueado: boolean };
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const alterar = (bloquear: boolean) =>
    new Promise<boolean>((resolver) => {
      iniciar(async () => {
        const resultado = await alterarBloqueioDoUsuarioAcao(usuario.id, bloquear);
        setErro(resultado.ok ? null : resultado.erro.mensagem);
        resolver(resultado.ok);
      });
    });

  return (
    <div className="flex flex-col items-start gap-2">
      {usuario.bloqueado ? (
        <Botao variante="contorno" carregando={pendente} onClick={() => void alterar(false)}>
          <LockOpen aria-hidden="true" className="size-4" />
          Desbloquear
          <span className="sr-only"> {usuario.nome}</span>
        </Botao>
      ) : (
        <DialogoDeConfirmacao
          rotuloDoGatilho="Bloquear"
          complementoDoGatilho={usuario.nome}
          iconeDoGatilho={<Ban aria-hidden="true" className="size-4" />}
          gatilhoCompacto
          titulo={`Bloquear ${usuario.nome}?`}
          rotuloDeConfirmar="Bloquear"
          pendente={pendente}
          aoConfirmar={() => alterar(true)}
        >
          <p>
            A pessoa perde o acesso na hora: a sessão aberta deixa de valer e ela não consegue
            entrar até ser desbloqueada.
          </p>
          <p>A conta e os dados continuam guardados. O bloqueio fica registrado na auditoria.</p>
          {erro && <Alerta tipo="erro">{erro}</Alerta>}
        </DialogoDeConfirmacao>
      )}
      {usuario.bloqueado && erro && <Alerta tipo="erro">{erro}</Alerta>}
    </div>
  );
}
