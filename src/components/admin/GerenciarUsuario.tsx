"use client";

import { Ban, LockOpen, Settings2 } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { alterarBloqueioDoUsuarioAcao, alterarPapelAcao } from "@/app/(painel)/admin/acoes";
import { Alerta } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { Dialogo } from "@/components/ui/Dialogo";
import {
  DESCRICAO_DO_PAPEL,
  PAPEIS_DE_ACESSO,
  ROTULO_DO_PAPEL,
  type PapelDeAcesso,
} from "@/lib/rotulos";
import type { ResultadoDeAcao } from "@/server/http/acao";

type Aviso = { tipo: "sucesso" | "erro"; texto: string } | null;

/**
 * Ajustes de uma conta que só o admin faz (D-030), no mesmo padrão do
 * "Gerenciar" das empresas:
 * - perfil de acesso: a pessoa se cadastra e o admin a promove; cada opção diz
 *   o que o perfil permite, e a troca vale na próxima página que ela abrir;
 * - bloqueio: pede confirmação no próprio diálogo, com as consequências
 *   escritas; desbloquear não pede (não tira nada de ninguém).
 * O serviço confere de novo: ninguém altera a própria conta, e a plataforma
 * nunca fica sem admin ativo.
 */
export function GerenciarUsuario({
  usuario,
}: {
  usuario: { id: string; nome: string; papel: PapelDeAcesso; bloqueado: boolean };
}) {
  const [escolhido, setEscolhido] = useState<PapelDeAcesso>(usuario.papel);
  const [confirmandoBloqueio, setConfirmandoBloqueio] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  // Uma transição por ação: o indicador de carregamento aparece só no botão clicado.
  const [salvandoPerfil, iniciarPerfil] = useTransition();
  const [alterandoBloqueio, iniciarBloqueio] = useTransition();
  const pendente = salvandoPerfil || alterandoBloqueio;
  const nomeDoGrupo = useId();
  const idDoPerfil = useId();
  const idDaSituacao = useId();

  const executar = (
    iniciar: typeof iniciarPerfil,
    acao: () => Promise<ResultadoDeAcao<null>>,
    sucesso: string,
  ) =>
    iniciar(async () => {
      const resultado = await acao();
      setAviso(
        resultado.ok
          ? { tipo: "sucesso", texto: sucesso }
          : { tipo: "erro", texto: resultado.erro.mensagem },
      );
    });

  const alterarBloqueio = (bloquear: boolean) => {
    setConfirmandoBloqueio(false);
    executar(
      iniciarBloqueio,
      () => alterarBloqueioDoUsuarioAcao(usuario.id, bloquear),
      bloquear ? "Conta bloqueada." : "Conta desbloqueada.",
    );
  };

  return (
    <Dialogo
      rotuloDoGatilho="Gerenciar"
      gatilhoCompacto
      complementoDoGatilho={usuario.nome}
      iconeDoGatilho={<Settings2 aria-hidden="true" className="size-4" />}
      titulo="Gerenciar usuário"
      descricao={usuario.nome}
      aoFechar={() => {
        setAviso(null);
        setConfirmandoBloqueio(false);
        setEscolhido(usuario.papel);
      }}
    >
      <form
        aria-labelledby={idDoPerfil}
        onSubmit={(evento) => {
          evento.preventDefault();
          executar(
            iniciarPerfil,
            () => alterarPapelAcao(usuario.id, escolhido),
            `Perfil alterado para ${ROTULO_DO_PAPEL[escolhido]}.`,
          );
        }}
        className="flex flex-col gap-3"
      >
        <fieldset className="flex flex-col gap-2">
          <legend id={idDoPerfil} className="mb-1 font-semibold">
            Perfil de acesso
          </legend>
          {PAPEIS_DE_ACESSO.map((papel) => (
            <label
              key={papel}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-borda p-3 has-checked:border-marca-texto has-checked:bg-superficie-2"
            >
              <input
                type="radio"
                name={nomeDoGrupo}
                value={papel}
                checked={escolhido === papel}
                onChange={() => setEscolhido(papel)}
                className="mt-1 size-4 shrink-0 accent-primaria"
              />
              <span className="flex flex-col">
                <span className="font-semibold">
                  {ROTULO_DO_PAPEL[papel]}
                  {papel === usuario.papel && (
                    <span className="font-normal text-texto-suave"> (atual)</span>
                  )}
                </span>
                <span className="text-sm text-texto-suave">{DESCRICAO_DO_PAPEL[papel]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Botao
          type="submit"
          variante="contorno"
          carregando={salvandoPerfil}
          disabled={pendente || escolhido === usuario.papel}
          className="self-start"
        >
          Salvar perfil
        </Botao>
      </form>

      <section
        aria-labelledby={idDaSituacao}
        className="flex flex-col gap-3 border-t border-borda pt-5"
      >
        <h3 id={idDaSituacao} className="font-semibold">
          Situação: {usuario.bloqueado ? "bloqueada" : "ativa"}
        </h3>
        {usuario.bloqueado ? (
          <>
            <p className="text-sm text-texto-suave">
              A pessoa não consegue entrar. A conta e os dados continuam guardados.
            </p>
            <Botao
              variante="contorno"
              carregando={alterandoBloqueio}
              disabled={pendente}
              onClick={() => alterarBloqueio(false)}
              className="self-start"
            >
              <LockOpen aria-hidden="true" className="size-4" />
              Desbloquear conta
            </Botao>
          </>
        ) : confirmandoBloqueio ? (
          <div className="flex flex-col gap-3 rounded-md border border-erro/40 bg-erro-fundo p-4 text-sm">
            <p className="font-semibold text-erro-alerta">Bloquear {usuario.nome}?</p>
            <ul className="list-disc space-y-1 pl-5 text-texto">
              <li>A sessão aberta deixa de valer na hora.</li>
              <li>A pessoa não consegue entrar até ser desbloqueada.</li>
              <li>Nada é apagado, e o bloqueio fica na auditoria.</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Botao variante="contorno" onClick={() => setConfirmandoBloqueio(false)}>
                Cancelar
              </Botao>
              <Botao variante="destrutivo" onClick={() => alterarBloqueio(true)}>
                Bloquear conta
              </Botao>
            </div>
          </div>
        ) : (
          <Botao
            variante="contorno"
            carregando={alterandoBloqueio}
            disabled={pendente}
            onClick={() => {
              setAviso(null);
              setConfirmandoBloqueio(true);
            }}
            className="self-start text-erro"
          >
            <Ban aria-hidden="true" className="size-4" />
            Bloquear conta…
          </Botao>
        )}
      </section>

      {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}
    </Dialogo>
  );
}
