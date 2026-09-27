"use client";

import { ShieldCheck } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { alterarPapelAcao } from "@/app/(painel)/admin/acoes";
import { Alerta } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { Dialogo } from "@/components/ui/Dialogo";
import {
  DESCRICAO_DO_PAPEL,
  PAPEIS_DE_ACESSO,
  ROTULO_DO_PAPEL,
  type PapelDeAcesso,
} from "@/lib/rotulos";

/**
 * Troca do perfil de acesso de uma conta (só admin, D-030). A pessoa cria a
 * conta pelo cadastro e o admin a promove; vale na próxima página que ela
 * abrir. Cada opção diz o que o perfil permite.
 */
export function AlterarPapel({
  usuario,
}: {
  usuario: { id: string; nome: string; papel: PapelDeAcesso };
}) {
  const [escolhido, setEscolhido] = useState<PapelDeAcesso>(usuario.papel);
  const [aviso, setAviso] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const nomeDoGrupo = useId();

  return (
    <Dialogo
      rotuloDoGatilho="Acesso"
      complementoDoGatilho={`de ${usuario.nome}`}
      iconeDoGatilho={<ShieldCheck aria-hidden="true" className="size-4" />}
      titulo="Perfil de acesso"
      descricao={usuario.nome}
      aoFechar={() => {
        setAviso(null);
        setEscolhido(usuario.papel);
      }}
    >
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          iniciar(async () => {
            const resultado = await alterarPapelAcao(usuario.id, escolhido);
            setAviso(
              resultado.ok
                ? { tipo: "sucesso", texto: `Perfil alterado para ${ROTULO_DO_PAPEL[escolhido]}.` }
                : { tipo: "erro", texto: resultado.erro.mensagem },
            );
          });
        }}
        className="flex flex-col gap-4"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Escolha o perfil</legend>
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
                className="mt-1 size-4 accent-primaria"
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
          carregando={pendente}
          disabled={escolhido === usuario.papel}
          className="self-start"
        >
          Salvar perfil
        </Botao>
        {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}
      </form>
    </Dialogo>
  );
}
