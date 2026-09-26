import type { Metadata } from "next";

import { Cabecalho } from "@/components/painel/Cabecalho";
import { FormularioNome, FormularioTrocaDeSenha } from "@/components/painel/FormulariosDoPerfil";
import { Avatar } from "@/components/ui/Avisos";
import { exigirPermissao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Meu perfil" };

const SECAO = "rounded-lg border border-borda bg-superficie p-5 sm:p-6";

export default async function PaginaPerfil() {
  const { usuario } = await exigirPermissao("perfil:editar");

  return (
    <>
      <Cabecalho titulo="Meu perfil" descricao="Seus dados de acesso à Brasa." />
      <div className="grid max-w-2xl gap-6">
        <section aria-labelledby="titulo-dados" className={SECAO}>
          <h2 id="titulo-dados" className="mb-5 text-lg font-semibold">
            Seus dados
          </h2>
          <div className="mb-5 flex items-center gap-4">
            <Avatar nome={usuario.nome} tamanho="lg" />
            <div className="text-sm">
              <p className="font-medium">Foto</p>
              <p className="text-texto-suave">
                Em breve você poderá enviar uma foto. Por enquanto, usamos as suas iniciais.
              </p>
            </div>
          </div>
          <FormularioNome nome={usuario.nome} />
          <p className="mt-5 text-sm text-texto-suave">
            E-mail de acesso: <span className="font-medium text-texto">{usuario.email}</span>
          </p>
        </section>

        <section aria-labelledby="titulo-senha" className={SECAO}>
          <h2 id="titulo-senha" className="mb-5 text-lg font-semibold">
            Senha
          </h2>
          <FormularioTrocaDeSenha />
        </section>
      </div>
    </>
  );
}
