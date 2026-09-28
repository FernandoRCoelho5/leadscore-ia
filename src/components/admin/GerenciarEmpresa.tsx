"use client";

import { Ban, LockOpen, Settings2 } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";

import {
  alterarLimiteDaEmpresaAcao,
  alterarSituacaoDaEmpresaAcao,
} from "@/app/(painel)/admin/acoes";
import { Alerta } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/Campo";
import { Dialogo } from "@/components/ui/Dialogo";
import type { ResultadoDeAcao } from "@/server/http/acao";

type Aviso = { tipo: "sucesso" | "erro"; texto: string } | null;

/** Mensagem do erro: a do campo, quando a validação diz qual foi. */
function mensagemDoErro(resultado: Extract<ResultadoDeAcao<unknown>, { ok: false }>): string {
  return resultado.erro.detalhes?.[0]?.mensagem ?? resultado.erro.mensagem;
}

/**
 * Ajustes da empresa que só o admin faz: limite mensal de análises e
 * bloqueio. O bloqueio pede confirmação no próprio diálogo, com as
 * consequências escritas; desbloquear não precisa (não tira nada de ninguém).
 */
export function GerenciarEmpresa({
  empresa,
}: {
  empresa: {
    id: string;
    nome: string;
    status: "ativa" | "bloqueada";
    limiteAnalisesMes: number;
    analisesNoMes: number;
  };
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [confirmandoBloqueio, setConfirmandoBloqueio] = useState(false);
  // Uma transição por ação: o indicador de carregamento aparece só no botão clicado.
  const [salvandoLimite, iniciarLimite] = useTransition();
  const [alterandoSituacao, iniciarSituacao] = useTransition();
  const pendente = salvandoLimite || alterandoSituacao;
  // Cada linha tem o próprio diálogo (e a lista aparece como tabela e como cartões).
  const idDoLimite = useId();
  const idDaSituacao = useId();
  const refSituacao = useRef<HTMLHeadingElement>(null);

  const executar = (
    iniciar: typeof iniciarLimite,
    acao: () => Promise<ResultadoDeAcao<null>>,
    sucesso: string,
  ) =>
    iniciar(async () => {
      const resultado = await acao();
      setAviso(
        resultado.ok
          ? { tipo: "sucesso", texto: sucesso }
          : { tipo: "erro", texto: mensagemDoErro(resultado) },
      );
    });

  const alterarSituacao = (situacao: "ativa" | "bloqueada") => {
    setConfirmandoBloqueio(false);
    executar(
      iniciarSituacao,
      () => alterarSituacaoDaEmpresaAcao(empresa.id, situacao),
      situacao === "bloqueada" ? "Empresa bloqueada." : "Empresa desbloqueada.",
    );
    // Os botões da confirmação somem: o foco volta para o título da seção.
    refSituacao.current?.focus();
  };

  return (
    <Dialogo
      rotuloDoGatilho="Gerenciar"
      complementoDoGatilho={empresa.nome}
      iconeDoGatilho={<Settings2 aria-hidden="true" className="size-4" />}
      titulo="Gerenciar empresa"
      descricao={empresa.nome}
      aoFechar={() => {
        setAviso(null);
        setConfirmandoBloqueio(false);
      }}
    >
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          const campo = evento.currentTarget.elements.namedItem("limite");
          const limite = campo instanceof HTMLInputElement ? campo.valueAsNumber : Number.NaN;
          executar(
            iniciarLimite,
            () => alterarLimiteDaEmpresaAcao(empresa.id, limite),
            "Limite atualizado.",
          );
        }}
        className="flex flex-col gap-3"
      >
        <CampoTexto
          id={idDoLimite}
          name="limite"
          rotulo="Limite de análises da IA por mês"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          required
          defaultValue={empresa.limiteAnalisesMes}
          ajuda={`Usadas neste mês: ${empresa.analisesNoMes}. Com o limite atingido, os novos leads chegam sem análise até o mês virar.`}
        />
        <Botao
          type="submit"
          variante="contorno"
          carregando={salvandoLimite}
          disabled={pendente}
          className="self-start"
        >
          Salvar limite
        </Botao>
      </form>

      <section
        aria-labelledby={idDaSituacao}
        className="flex flex-col gap-3 border-t border-borda pt-5"
      >
        <h3
          id={idDaSituacao}
          ref={refSituacao}
          tabIndex={-1}
          className="font-semibold outline-none"
        >
          Situação: {empresa.status === "ativa" ? "ativa" : "bloqueada"}
        </h3>
        {empresa.status === "bloqueada" ? (
          <>
            <p className="text-sm text-texto-suave">
              O formulário de captação não recebe leads e os usuários da empresa não entram no
              painel. Nada foi apagado.
            </p>
            <Botao
              variante="contorno"
              carregando={alterandoSituacao}
              disabled={pendente}
              onClick={() => alterarSituacao("ativa")}
              className="self-start"
            >
              <LockOpen aria-hidden="true" className="size-4" />
              Desbloquear empresa
            </Botao>
          </>
        ) : confirmandoBloqueio ? (
          <div className="flex flex-col gap-3 rounded-md border border-erro/40 bg-erro-fundo p-4 text-sm">
            <p className="font-semibold text-erro-alerta">Bloquear {empresa.nome}?</p>
            <ul className="list-disc space-y-1 pl-5 text-texto">
              <li>O formulário de captação para de receber leads na hora.</li>
              <li>Os usuários da empresa perdem o acesso ao painel.</li>
              <li>Nada é apagado, e dá para desbloquear depois.</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Botao variante="contorno" onClick={() => setConfirmandoBloqueio(false)}>
                Cancelar
              </Botao>
              <Botao variante="destrutivo" onClick={() => alterarSituacao("bloqueada")}>
                Bloquear empresa
              </Botao>
            </div>
          </div>
        ) : (
          <Botao
            variante="contorno"
            carregando={alterandoSituacao}
            disabled={pendente}
            onClick={() => {
              setAviso(null);
              setConfirmandoBloqueio(true);
            }}
            className="self-start text-erro"
          >
            <Ban aria-hidden="true" className="size-4" />
            Bloquear empresa…
          </Botao>
        )}
      </section>

      {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}
    </Dialogo>
  );
}
