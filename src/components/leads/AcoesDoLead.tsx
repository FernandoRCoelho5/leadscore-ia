"use client";

import { EyeOff, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  alterarStatusAcao,
  anonimizarLeadAcao,
  excluirLeadAcao,
  reanalisarLeadAcao,
} from "@/app/(painel)/leads/acoes";
import type { StatusLead } from "@/db/schema";
import { Alerta } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { CampoTexto, Selecao } from "@/components/ui/Campo";
import { DialogoDeConfirmacao } from "@/components/ui/DialogoDeConfirmacao";
import { useToasts } from "@/components/ui/Toasts";
import {
  PALAVRA_PARA_ANONIMIZAR,
  ROTULO_DA_CLASSIFICACAO,
  ROTULO_DO_STATUS,
  STATUS_DO_LEAD,
} from "@/lib/rotulos";

/**
 * Sucesso vira toast (some sozinho, sem empurrar a tela); erro fica ao lado
 * do botão, perto de onde aconteceu, até a próxima tentativa.
 */

/** Andamento do lead no funil comercial (novo, em contato, ganho, perdido). */
export function FormularioDeStatus({
  leadId,
  statusAtual,
}: {
  leadId: string;
  statusAtual: StatusLead;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const { avisar } = useToasts();

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        // "Novo" é a primeira opção da Selecao, que tem valor vazio.
        const status = new FormData(evento.currentTarget).get("status") || "novo";
        iniciar(async () => {
          const resultado = await alterarStatusAcao(leadId, status);
          setErro(resultado.ok ? null : resultado.erro.mensagem);
          if (resultado.ok) {
            avisar("sucesso", "Andamento atualizado.");
          }
        });
      }}
      className="flex flex-col gap-3"
    >
      <Selecao
        id="status"
        rotulo="Etapa atual"
        opcoes={STATUS_DO_LEAD.filter((valor) => valor !== "novo").map((valor) => ({
          valor,
          rotulo: ROTULO_DO_STATUS[valor],
        }))}
        textoVazio={ROTULO_DO_STATUS.novo}
        defaultValue={statusAtual === "novo" ? "" : statusAtual}
        name="status"
      />
      <Botao type="submit" variante="contorno" carregando={pendente}>
        Salvar andamento
      </Botao>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
    </form>
  );
}

const MENSAGEM_DA_REANALISE = {
  limite_atingido: "O limite de análises do mês acabou. Fale com a equipe Brasa para ampliar.",
  em_andamento: "Este lead já está em análise. Aguarde alguns segundos e recarregue a página.",
  falhou: "A análise falhou desta vez. Tente de novo em alguns minutos.",
} as const;

export function BotaoReanalisar({ leadId, rotulo }: { leadId: string; rotulo: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const { avisar } = useToasts();

  return (
    <div className="flex flex-col gap-3">
      <Botao
        variante="contorno"
        carregando={pendente}
        onClick={() =>
          iniciar(async () => {
            const resultado = await reanalisarLeadAcao(leadId);
            if (!resultado.ok) {
              setErro(resultado.erro.mensagem);
              return;
            }
            const { dados } = resultado;
            if (dados.situacao === "concluida") {
              // A página se atualiza com a análise nova, que aparece com a revelação do termômetro.
              setErro(null);
              avisar(
                "sucesso",
                `Análise concluída: nota ${dados.score} (${ROTULO_DA_CLASSIFICACAO[dados.classificacao].toLowerCase()}).`,
              );
            } else {
              setErro(MENSAGEM_DA_REANALISE[dados.situacao]);
            }
          })
        }
      >
        {!pendente && <RefreshCw aria-hidden="true" className="size-4" />}
        {pendente ? "Analisando…" : rotulo}
      </Botao>
      <p className="text-xs text-texto-suave">Cada nova análise usa 1 do limite do mês.</p>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
    </div>
  );
}

/** Excluir (lógico) e anonimizar (LGPD): ações destrutivas, sempre com confirmação. */
export function ZonaDeRisco({ leadId, anonimizado }: { leadId: string; anonimizado: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [pendente, iniciar] = useTransition();

  const executar = (acao: () => Promise<{ ok: boolean; erro?: { mensagem: string } }>) =>
    new Promise<boolean>((resolver) => {
      iniciar(async () => {
        const resultado = await acao();
        setErro(resultado.ok ? null : (resultado.erro?.mensagem ?? "Não foi possível concluir."));
        resolver(resultado.ok);
      });
    });

  return (
    <div className="flex flex-col gap-2">
      {!anonimizado && (
        <DialogoDeConfirmacao
          rotuloDoGatilho="Anonimizar dados (LGPD)"
          iconeDoGatilho={<EyeOff aria-hidden="true" className="size-4" />}
          titulo="Anonimizar os dados deste lead?"
          rotuloDeConfirmar="Anonimizar"
          pendente={pendente}
          confirmarDesabilitado={confirmacao.trim().toUpperCase() !== PALAVRA_PARA_ANONIMIZAR}
          aoConfirmar={() => executar(() => anonimizarLeadAcao(leadId, confirmacao))}
        >
          <p>
            Use quando o titular pedir a eliminação dos dados. Nome, e-mail, telefone, empresa e a
            mensagem serão apagados, e também os textos das análises.{" "}
            <strong className="text-texto">Não dá para desfazer.</strong>
          </p>
          <p>Ficam só a nota, a classificação, o segmento e as datas, para as estatísticas.</p>
          <CampoTexto
            id="confirmacao"
            rotulo={`Digite ${PALAVRA_PARA_ANONIMIZAR} para confirmar`}
            autoComplete="off"
            value={confirmacao}
            onChange={(evento) => setConfirmacao(evento.target.value)}
          />
          {erro && <Alerta tipo="erro">{erro}</Alerta>}
        </DialogoDeConfirmacao>
      )}
      <DialogoDeConfirmacao
        rotuloDoGatilho="Excluir lead"
        iconeDoGatilho={<Trash2 aria-hidden="true" className="size-4" />}
        titulo="Excluir este lead?"
        rotuloDeConfirmar="Excluir"
        pendente={pendente}
        aoConfirmar={async () => {
          const ok = await executar(() => excluirLeadAcao(leadId));
          if (ok) {
            router.push("/leads");
          }
          return ok;
        }}
      >
        <p>
          O lead sai da lista e das exportações. O registro continua guardado para auditoria; para
          apagar os dados pessoais, use &quot;Anonimizar dados&quot;.
        </p>
        {erro && <Alerta tipo="erro">{erro}</Alerta>}
      </DialogoDeConfirmacao>
    </div>
  );
}
