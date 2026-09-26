"use client";

import { useEffect, useRef } from "react";
import { z } from "zod";

import { salvarNomeAcao } from "@/app/(painel)/perfil/acoes";
import { Alerta, ResumoDeErros } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/Campo";
import { CampoSenha } from "@/components/ui/CampoSenha";
import { useFormulario } from "@/components/ui/useFormulario";
import { authCliente } from "@/lib/auth/cliente";
import { mensagemDoErroDeAutenticacao } from "@/lib/auth/erros";
import { SENHA_MINIMO, esquemaNome, esquemaTrocaDeSenha } from "@/lib/validacao/auth";

const esquemaDoNome = z.object({ nome: esquemaNome });

export function FormularioNome({ nome }: { nome: string }) {
  const { aoEnviar, erros, erroGeral, pendente, sucesso, refResumo } = useFormulario({
    esquema: esquemaDoNome,
    enviar: (_dados, brutos) => salvarNomeAcao(brutos),
  });

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
      <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
      {sucesso && <Alerta tipo="sucesso">Nome atualizado.</Alerta>}
      <CampoTexto
        id="nome"
        rotulo="Nome"
        autoComplete="name"
        required
        defaultValue={nome}
        erro={erros.nome}
      />
      <div>
        <Botao type="submit" carregando={pendente}>
          Salvar nome
        </Botao>
      </div>
    </form>
  );
}

export function FormularioTrocaDeSenha() {
  const refFormulario = useRef<HTMLFormElement>(null);
  const { aoEnviar, erros, erroGeral, pendente, sucesso, refResumo } = useFormulario({
    esquema: esquemaTrocaDeSenha,
    enviar: async ({ senhaAtual, senha }) => {
      const { error } = await authCliente.changePassword({
        currentPassword: senhaAtual,
        newPassword: senha,
        // Encerra a conta nos outros aparelhos: útil se a senha vazou.
        revokeOtherSessions: true,
      });
      if (error) {
        return { ok: false, erro: { mensagem: mensagemDoErroDeAutenticacao(error) } };
      }
    },
  });

  // Depois de trocar, limpa os campos (senhas não devem ficar na tela).
  useEffect(() => {
    if (sucesso) {
      refFormulario.current?.reset();
    }
  }, [sucesso]);

  return (
    <form ref={refFormulario} noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
      <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
      {sucesso && (
        <Alerta tipo="sucesso">
          Senha alterada. Por segurança, encerramos a sua sessão nos outros aparelhos.
        </Alerta>
      )}
      <CampoSenha
        id="senhaAtual"
        rotulo="Senha atual"
        autoComplete="current-password"
        required
        erro={erros.senhaAtual}
      />
      <CampoSenha
        id="senha"
        rotulo="Nova senha"
        autoComplete="new-password"
        required
        ajuda={`Mínimo de ${SENHA_MINIMO} caracteres.`}
        erro={erros.senha}
      />
      <CampoSenha
        id="confirmacao"
        rotulo="Repita a nova senha"
        autoComplete="new-password"
        required
        erro={erros.confirmacao}
      />
      <div>
        <Botao type="submit" carregando={pendente}>
          Trocar senha
        </Botao>
      </div>
    </form>
  );
}
