import { Flame } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Cabecalho } from "@/components/painel/Cabecalho";
import { EstadoVazio } from "@/components/ui/Avisos";
import { exigirPermissao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Visão geral" };

export default async function PaginaVisaoGeral() {
  const sessao = await exigirPermissao("painel:ver");
  const primeiroNome = sessao.usuario.nome.split(" ")[0];

  return (
    <>
      <Cabecalho
        titulo={`Olá, ${primeiroNome}!`}
        descricao={
          sessao.empresaAtiva ? sessao.empresaAtiva.nome : "Administração da plataforma Brasa"
        }
      />
      <EstadoVazio
        icone={<Flame aria-hidden="true" />}
        titulo="Seus leads vão aparecer aqui"
        descricao="Quando o formulário de captação estiver no ar, cada lead chega classificado em quente, morno ou frio, com a resposta sugerida pela IA."
        acao={
          sessao.empresaAtiva ? (
            <Link
              href="/configuracoes"
              className="text-sm font-semibold text-marca-texto underline-offset-2 hover:underline"
            >
              Revisar o perfil do negócio
            </Link>
          ) : undefined
        }
      />
    </>
  );
}
