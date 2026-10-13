"use client";

import { Send, Trash2 } from "lucide-react";
import { useState } from "react";

import { Alerta } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { BotaoCopiar } from "@/components/ui/BotaoCopiar";
import { DialogoDeConfirmacao } from "@/components/ui/DialogoDeConfirmacao";
import { ProvedorDeToasts, useToasts } from "@/components/ui/Toasts";

/** Demonstrações que precisam de estado: nada aqui grava dados. */
export function Interativos({ tema }: { tema: string }) {
  return (
    <ProvedorDeToasts>
      <div className="flex flex-col gap-5">
        <EnvioSimulado />
        <BotoesDeToast />
        <BotaoCopiar texto="Olá! Recebemos seu contato." rotulo="Copiar resposta" />
        <ConfirmacaoSimulada tema={tema} />
      </div>
    </ProvedorDeToasts>
  );
}

/** Feedback de envio: carregando, depois sucesso (ou erro, alternando). */
function EnvioSimulado() {
  const [estado, setEstado] = useState<"parado" | "enviando" | "sucesso" | "erro">("parado");
  const [proximoFalha, setProximoFalha] = useState(false);

  function enviar() {
    setEstado("enviando");
    setTimeout(() => {
      setEstado(proximoFalha ? "erro" : "sucesso");
      setProximoFalha((atual) => !atual);
    }, 900);
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Botao carregando={estado === "enviando"} onClick={enviar}>
        <Send aria-hidden="true" className="size-4" />
        Enviar (simulação)
      </Botao>
      {estado === "sucesso" && <Alerta tipo="sucesso">Mensagem enviada.</Alerta>}
      {estado === "erro" && <Alerta tipo="erro">Não conseguimos enviar. Tente de novo.</Alerta>}
    </div>
  );
}

function BotoesDeToast() {
  const { avisar } = useToasts();
  return (
    <div className="flex flex-wrap gap-2">
      <Botao variante="contorno" onClick={() => avisar("sucesso", "Lead salvo.")}>
        Toast de sucesso
      </Botao>
      <Botao variante="contorno" onClick={() => avisar("info", "3 leads quentes chegaram.")}>
        Toast informativo
      </Botao>
      <Botao
        variante="contorno"
        onClick={() => avisar("erro", "Não conseguimos salvar. Tente de novo.")}
      >
        Toast de erro
      </Botao>
    </div>
  );
}

function ConfirmacaoSimulada({ tema }: { tema: string }) {
  const [pendente, setPendente] = useState(false);
  return (
    <DialogoDeConfirmacao
      rotuloDoGatilho="Excluir lead (simulação)"
      complementoDoGatilho={`no tema ${tema}`}
      iconeDoGatilho={<Trash2 aria-hidden="true" className="size-4" />}
      titulo="Excluir este lead?"
      rotuloDeConfirmar="Excluir"
      pendente={pendente}
      aoConfirmar={async () => {
        setPendente(true);
        await new Promise((resolver) => setTimeout(resolver, 700));
        setPendente(false);
        return true;
      }}
    >
      <p>Nada é apagado: este é o catálogo de componentes.</p>
    </DialogoDeConfirmacao>
  );
}
