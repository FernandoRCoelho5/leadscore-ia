import type { Metadata } from "next";

import { Cabecalho } from "@/components/painel/Cabecalho";
import { FormularioFoto } from "@/components/painel/FormularioFoto";
import { FormularioNome, FormularioTrocaDeSenha } from "@/components/painel/FormulariosDoPerfil";
import { Cartao } from "@/components/ui/Cartao";
import { ConteudoQueChega } from "@/components/ui/Revelacao";
import { exigirPermissao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function PaginaPerfil() {
  const { usuario } = await exigirPermissao("perfil:editar");

  return (
    <ConteudoQueChega>
      <Cabecalho
        titulo="Meu perfil"
        descricao="Sua foto, seu nome e seus dados de acesso à Brasa."
      />
      <div className="grid max-w-2xl gap-6">
        <Cartao titulo="Seus dados">
          <FormularioFoto nome={usuario.nome} fotoUrl={usuario.fotoUrl} />
          <FormularioNome nome={usuario.nome} />
          <p className="mt-5 text-sm text-texto-suave">
            E-mail de acesso: <span className="font-medium text-texto">{usuario.email}</span>
          </p>
        </Cartao>

        <Cartao titulo="Senha">
          <FormularioTrocaDeSenha />
        </Cartao>
      </div>
    </ConteudoQueChega>
  );
}
