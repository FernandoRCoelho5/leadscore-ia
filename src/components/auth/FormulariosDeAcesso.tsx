"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alerta, ResumoDeErros } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/Campo";
import { CampoSenha } from "@/components/ui/CampoSenha";
import { useFormulario, type ResultadoDoEnvio } from "@/components/ui/useFormulario";
import { authCliente } from "@/lib/auth/cliente";
import { mensagemDoErroDeAutenticacao, type ErroDeAutenticacao } from "@/lib/auth/erros";
import {
  SENHA_MINIMO,
  esquemaCadastro,
  esquemaEsqueciSenha,
  esquemaLogin,
  esquemaNovaSenha,
} from "@/lib/validacao/auth";

/**
 * Formulários de acesso. Chamam as rotas /api/auth/* pelo cliente do Better
 * Auth, que têm limite de tentativas (proteção contra força bruta).
 */

function falha(erro: ErroDeAutenticacao): ResultadoDoEnvio {
  return { ok: false, erro: { mensagem: mensagemDoErroDeAutenticacao(erro) } };
}

const LINK = "font-semibold text-marca-texto underline-offset-2 hover:underline";

export function FormularioLogin({ destino, aviso }: { destino: string; aviso?: string }) {
  const router = useRouter();
  const { aoEnviar, erros, erroGeral, pendente, refResumo } = useFormulario({
    esquema: esquemaLogin,
    enviar: async ({ email, senha }) => {
      const { error } = await authCliente.signIn.email({ email, password: senha });
      if (error) {
        return falha(error);
      }
      router.replace(destino);
      router.refresh();
    },
  });

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
      {aviso && <Alerta tipo="sucesso">{aviso}</Alerta>}
      <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
      <CampoTexto
        id="email"
        rotulo="E-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        erro={erros.email}
      />
      <div className="flex flex-col gap-2">
        <CampoSenha
          id="senha"
          rotulo="Senha"
          autoComplete="current-password"
          required
          erro={erros.senha}
        />
        <Link href="/esqueci-senha" className={`self-end text-sm ${LINK}`}>
          Esqueci minha senha
        </Link>
      </div>
      <Botao type="submit" carregando={pendente} larguraTotal>
        Entrar
      </Botao>
    </form>
  );
}

export function FormularioCadastro() {
  const router = useRouter();
  const { aoEnviar, erros, erroGeral, pendente, refResumo } = useFormulario({
    esquema: esquemaCadastro,
    enviar: async ({ nome, email, senha }) => {
      const { error } = await authCliente.signUp.email({ name: nome, email, password: senha });
      if (error) {
        return falha(error);
      }
      router.replace("/onboarding");
      router.refresh();
    },
  });

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
      <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
      <CampoTexto id="nome" rotulo="Seu nome" autoComplete="name" required erro={erros.nome} />
      <CampoTexto
        id="email"
        rotulo="E-mail de trabalho"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        erro={erros.email}
      />
      <CampoSenha
        id="senha"
        rotulo="Senha"
        autoComplete="new-password"
        required
        ajuda={`Mínimo de ${SENHA_MINIMO} caracteres. Dica: use uma frase fácil de lembrar.`}
        erro={erros.senha}
      />
      <Botao type="submit" carregando={pendente} larguraTotal>
        Criar conta
      </Botao>
    </form>
  );
}

export function FormularioEsqueciSenha() {
  const { aoEnviar, erros, erroGeral, pendente, sucesso, refResumo } = useFormulario({
    esquema: esquemaEsqueciSenha,
    enviar: async ({ email }) => {
      const { error } = await authCliente.requestPasswordReset({
        email,
        redirectTo: "/redefinir-senha",
      });
      // Só o excesso de tentativas vira erro: a resposta não revela se o e-mail existe.
      if (error?.status === 429) {
        return falha(error);
      }
    },
  });

  if (sucesso) {
    return (
      <Alerta tipo="sucesso">
        Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale
        por 1 hora.
      </Alerta>
    );
  }

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
      <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
      <CampoTexto
        id="email"
        rotulo="E-mail da conta"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        erro={erros.email}
      />
      <Botao type="submit" carregando={pendente} larguraTotal>
        Enviar link
      </Botao>
    </form>
  );
}

export function FormularioRedefinirSenha({ token }: { token: string }) {
  const router = useRouter();
  const { aoEnviar, erros, erroGeral, pendente, refResumo } = useFormulario({
    esquema: esquemaNovaSenha,
    enviar: async ({ senha }) => {
      const { error } = await authCliente.resetPassword({ newPassword: senha, token });
      if (error) {
        return falha(error);
      }
      router.replace("/login?redefinida=1");
    },
  });

  return (
    <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-5">
      <ResumoDeErros mensagem={erroGeral} erros={erros} refResumo={refResumo} />
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
      <Botao type="submit" carregando={pendente} larguraTotal>
        Salvar nova senha
      </Botao>
    </form>
  );
}
