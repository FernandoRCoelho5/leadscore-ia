import type { Metadata } from "next";
import Link from "next/link";

import { sairAcao } from "@/app/acoes";
import { BotaoAceitarConvite } from "@/components/membros/BotaoAceitarConvite";
import { Alerta } from "@/components/ui/Avisos";
import { classesDeBotao } from "@/components/ui/Botao";
import { db } from "@/db";
import { mascararEmail } from "@/lib/privacidade";
import { DIAS_DE_VALIDADE_DO_CONVITE } from "@/lib/validacao/membros";
import { obterSessao } from "@/server/auth/sessao";
import { consultarConvite } from "@/server/services/membros";

// O token está no endereço: a página não vai para buscadores nem para o Referer.
export const metadata: Metadata = {
  title: "Convite",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const LINK = "font-semibold text-marca-texto underline-offset-2 hover:underline";

/**
 * Página do link de convite (D-030). Mostra a empresa e para qual e-mail o
 * convite vale; quem entrou com esse e-mail aceita com um clique. Quem ainda
 * não tem conta cria e volta para cá.
 */
export default async function PaginaConvite({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const [convite, sessao] = await Promise.all([consultarConvite(db, token), obterSessao()]);

  if (convite.situacao === "invalido") {
    return (
      <Aviso titulo="Convite inválido">
        O link pode ter sido cancelado ou copiado pela metade. Peça um convite novo a quem convidou
        você.
      </Aviso>
    );
  }
  if (convite.situacao === "usado") {
    return (
      <Aviso titulo="Este convite já foi usado">
        {sessao ? (
          <>
            Se foi você quem aceitou, a {convite.empresaNome} já aparece no{" "}
            <Link href="/painel" className={LINK}>
              painel
            </Link>
            .
          </>
        ) : (
          <>
            Se foi você quem aceitou,{" "}
            <Link href="/login" className={LINK}>
              entre na sua conta
            </Link>{" "}
            para ver a {convite.empresaNome}.
          </>
        )}
      </Aviso>
    );
  }
  if (convite.situacao === "expirado") {
    return (
      <Aviso titulo="Este convite expirou">
        Os convites valem por {DIAS_DE_VALIDADE_DO_CONVITE} dias. Peça um novo a quem convidou você
        para a {convite.empresaNome}.
      </Aviso>
    );
  }

  const destino = encodeURIComponent(`/convite/${token}`);
  const emailMascarado = mascararEmail(convite.email);

  return (
    <>
      <h1 className="text-2xl font-bold">Convite para a {convite.empresaNome}</h1>
      <p className="mt-2 text-sm text-texto-suave">
        Você foi convidado para entrar na {convite.empresaNome} na Brasa e acompanhar os leads da
        empresa, já classificados pela IA.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {!sessao ? (
          <>
            <p className="text-sm">
              O convite vale para <strong>{emailMascarado}</strong>. Entre ou crie a sua conta com
              esse e-mail.
            </p>
            <Link href={`/cadastro?proximo=${destino}`} className={classesDeBotao("primaria")}>
              Criar conta
            </Link>
            <Link href={`/login?proximo=${destino}`} className={classesDeBotao("contorno")}>
              Já tenho conta
            </Link>
          </>
        ) : sessao.papel !== "cliente" ? (
          <Alerta tipo="erro">
            Contas da equipe Brasa não entram em empresas de clientes: vocês já veem todas pela
            lista de Empresas.
          </Alerta>
        ) : sessao.usuario.email.toLowerCase() !== convite.email ? (
          <>
            <Alerta tipo="erro">
              Este convite vale para {emailMascarado}, mas você entrou como {sessao.usuario.email}.
              Saia e entre com a conta do e-mail convidado.
            </Alerta>
            <form action={sairAcao}>
              <button type="submit" className={`${classesDeBotao("contorno")} w-full`}>
                Sair da conta
              </button>
            </form>
          </>
        ) : (
          <BotaoAceitarConvite token={token} empresaNome={convite.empresaNome} />
        )}
      </div>
    </>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="mt-2 text-sm text-texto-suave">{children}</p>
      <Link href="/" className={`${classesDeBotao("contorno")} mt-6 w-full`}>
        Ir para a página inicial
      </Link>
    </>
  );
}
