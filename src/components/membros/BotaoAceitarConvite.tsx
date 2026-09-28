"use client";

import { useState, useTransition } from "react";

import { aceitarConviteAcao } from "@/app/(publico)/convite/[token]/acoes";
import { Alerta } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";

/** Aceita o convite; deu certo, a action leva direto ao painel da empresa. */
export function BotaoAceitarConvite({
  token,
  empresaNome,
}: {
  token: string;
  empresaNome: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <Botao
        larguraTotal
        carregando={pendente}
        onClick={() =>
          iniciar(async () => {
            const resultado = await aceitarConviteAcao(token);
            if (!resultado.ok) {
              setErro(resultado.erro.mensagem);
            }
          })
        }
      >
        Aceitar e entrar na {empresaNome}
      </Botao>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
    </div>
  );
}
