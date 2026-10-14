import { ArrowRight, Link2, Share2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { Cabecalho } from "@/components/painel/Cabecalho";
import {
  BarrasDeAndamento,
  BarrasDeClassificacao,
  BlocoDeIndicador,
  MedidorDeConsumo,
} from "@/components/painel/Indicadores";
import { QuentesSemResposta } from "@/components/painel/QuentesSemResposta";
import { classesDeBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { ConteudoQueChega } from "@/components/ui/Revelacao";
import { db } from "@/db";
import { custoEstimadoEmDolares, formatarDolares } from "@/lib/custoDaIa";
import { DIAS_DO_PERIODO, formatarData, formatarDataHora, inicioDosUltimosDias } from "@/lib/datas";
import { pode } from "@/server/auth/permissoes";
import { contextoDa, exigirPermissao, type Sessao } from "@/server/auth/sessao";
import { visaoGeralDaEmpresa, visaoGeralDaPlataforma } from "@/server/services/painel";

export const metadata: Metadata = { title: "Visão geral" };

const MES = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long" });

/** "últimos 30 dias" e "desde 15/09/2026", para os rótulos dos indicadores (D-036). */
function periodo(agora: Date) {
  return {
    nome: `últimos ${DIAS_DO_PERIODO} dias`,
    desde: `desde ${formatarData(inicioDosUltimosDias(agora))}`,
  };
}

/** As análises seguem o mês do calendário: é nele que o limite do plano zera. */
const rotuloDasAnalises = (agora: Date) => `Análises da IA em ${MES.format(agora)}`;

function Passo({
  numero,
  icone,
  titulo,
  children,
}: {
  numero: number;
  icone: ReactNode;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <li style={{ "--i": numero } as CSSProperties} className="escalonado flex animate-entrar gap-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-quente-fundo text-quente-icone [&>svg]:size-5"
      >
        {icone}
      </span>
      <div>
        <h3 className="font-semibold">
          <span className="sr-only">Passo {numero}: </span>
          {titulo}
        </h3>
        <p className="text-sm text-texto-suave">{children}</p>
      </div>
    </li>
  );
}

/** Empresa sem nenhum lead: em vez de números zerados, os três passos até o primeiro. */
function PrimeirosPassos({ podeConfigurar }: { podeConfigurar: boolean }) {
  return (
    <Cartao
      titulo="Seus leads vão aparecer aqui"
      descricao="Cada contato chega classificado em quente, morno ou frio, com a resposta sugerida pela IA."
    >
      <ol className="grid gap-5 sm:grid-cols-3">
        <Passo numero={1} icone={<Link2 />} titulo="Pegue o link">
          O formulário de captação da sua empresa já está no ar.
        </Passo>
        <Passo numero={2} icone={<Share2 />} titulo="Divulgue">
          No site, nas redes sociais, no WhatsApp ou num QR code no balcão.
        </Passo>
        <Passo numero={3} icone={<Sparkles />} titulo="Responda os quentes">
          A IA dá a nota e sugere a resposta: comece pelos que estão em brasa.
        </Passo>
      </ol>
      {podeConfigurar && (
        <Link href="/configuracoes" className={`${classesDeBotao("primaria")} mt-6`}>
          Ver o link do formulário
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </Cartao>
  );
}

async function VisaoDaEmpresa({ sessao, empresaId }: { sessao: Sessao; empresaId: string }) {
  const agora = new Date();
  const visao = await visaoGeralDaEmpresa(db, contextoDa(sessao), empresaId, agora);
  const { leads } = visao;
  const { nome, desde } = periodo(agora);

  if (leads.total === 0) {
    return <PrimeirosPassos podeConfigurar={pode(sessao.ator, "empresa:editar", empresaId)} />;
  }

  const percentualQuentes =
    leads.doPeriodo === 0 ? 0 : Math.round((leads.porClassificacao.quente / leads.doPeriodo) * 100);

  return (
    <div className="flex flex-col gap-6">
      {leads.quentesSemResposta > 0 && <QuentesSemResposta quantidade={leads.quentesSemResposta} />}

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BlocoDeIndicador
          ordem={0}
          rotulo={`Leads nos ${nome}`}
          valor={leads.doPeriodo}
          detalhe={desde}
        />
        <BlocoDeIndicador
          ordem={1}
          rotulo={`Quentes nos ${nome}`}
          valor={leads.porClassificacao.quente}
          detalhe={`${percentualQuentes}% dos leads do período`}
        />
        <BlocoDeIndicador
          ordem={2}
          rotulo="Negócios ganhos"
          valor={leads.porStatus.ganho}
          detalhe={`de ${leads.total.toLocaleString("pt-BR")} leads no total`}
        />
        <BlocoDeIndicador
          ordem={3}
          rotulo={rotuloDasAnalises(agora)}
          valor={`${visao.analisesUsadas} / ${visao.limiteDeAnalises}`}
        >
          <MedidorDeConsumo usadas={visao.analisesUsadas} limite={visao.limiteDeAnalises} />
        </BlocoDeIndicador>
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Classificação dos leads" descricao={`Recebidos nos ${nome}`}>
          <BarrasDeClassificacao contagem={leads.porClassificacao} total={leads.doPeriodo} />
        </Cartao>
        <Cartao titulo="Andamento de todos os leads" descricao="Desde o primeiro lead">
          <BarrasDeAndamento contagem={leads.porStatus} total={leads.total} />
        </Cartao>
      </div>

      <Cartao
        titulo="Quentes mais recentes"
        acao={
          <Link
            href="/leads?classificacao=quente"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-marca-texto hover:underline"
          >
            Ver todos os quentes
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      >
        {visao.quentesRecentes.length === 0 ? (
          <p className="text-sm text-texto-suave">
            Nenhum lead quente ainda. Quando chegar, ele aparece aqui primeiro.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda">
            {visao.quentesRecentes.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-marca-texto"
                >
                  {/* No celular o nome ganha linha própria: dividindo a linha com
                      selo, nota e data, ele encolhia até sumir. */}
                  <span className="w-full min-w-0 truncate font-semibold sm:w-auto sm:flex-1">
                    {lead.nome}
                  </span>
                  <BadgeClassificacao classificacao={lead.classificacaoAtual} />
                  <span className="font-semibold tabular-nums">{lead.scoreAtual}</span>
                  <span className="text-sm text-texto-suave tabular-nums">
                    {formatarDataHora(lead.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

async function VisaoDaPlataforma({ sessao }: { sessao: Sessao }) {
  const agora = new Date();
  const resumo = await visaoGeralDaPlataforma(db, contextoDa(sessao), agora);
  const custo = custoEstimadoEmDolares(resumo.tokensEntradaNoMes, resumo.tokensSaidaNoMes);
  const { nome, desde } = periodo(agora);
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BlocoDeIndicador
          ordem={0}
          rotulo="Empresas ativas"
          valor={resumo.empresasAtivas}
          detalhe={`${resumo.empresasBloqueadas} bloqueada(s)`}
        />
        <BlocoDeIndicador
          ordem={1}
          rotulo="Usuários"
          valor={resumo.usuarios}
          detalhe={`${resumo.usuariosBloqueados} bloqueado(s)`}
        />
        <BlocoDeIndicador
          ordem={2}
          rotulo={`Leads nos ${nome}`}
          valor={resumo.leadsRecentes}
          detalhe={desde}
        />
        <BlocoDeIndicador
          ordem={3}
          rotulo={rotuloDasAnalises(agora)}
          valor={resumo.analisesNoMes}
          detalhe={`Custo estimado: ${formatarDolares(custo)}`}
        />
      </dl>
      <p className="text-sm text-texto-suave">
        Para ver os leads de um cliente, abra a empresa na lista de{" "}
        <Link href="/admin/empresas" className="font-semibold text-marca-texto hover:underline">
          Empresas
        </Link>
        . O acesso fica registrado na auditoria.
      </p>
    </div>
  );
}

export default async function PaginaVisaoGeral() {
  const sessao = await exigirPermissao("painel:ver");
  const primeiroNome = sessao.usuario.nome.split(" ")[0];
  const empresa = sessao.empresaAtiva;

  return (
    <ConteudoQueChega>
      <Cabecalho
        titulo={`Olá, ${primeiroNome}!`}
        descricao={empresa ? empresa.nome : "Administração da plataforma Brasa"}
      />
      {empresa ? (
        <VisaoDaEmpresa sessao={sessao} empresaId={empresa.empresaId} />
      ) : (
        <VisaoDaPlataforma sessao={sessao} />
      )}
    </ConteudoQueChega>
  );
}
