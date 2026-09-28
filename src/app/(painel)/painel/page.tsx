import { ArrowRight, Flame } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { Cabecalho } from "@/components/painel/Cabecalho";
import {
  BarrasDeAndamento,
  BarrasDeClassificacao,
  BlocoDeIndicador,
  MedidorDeConsumo,
} from "@/components/painel/Indicadores";
import { EstadoVazio } from "@/components/ui/Avisos";
import { classesDeBotao } from "@/components/ui/Botao";
import { db } from "@/db";
import { custoEstimadoEmDolares, formatarDolares } from "@/lib/custoDaIa";
import { formatarDataHora } from "@/lib/datas";
import { pode } from "@/server/auth/permissoes";
import { contextoDa, exigirPermissao, type Sessao } from "@/server/auth/sessao";
import { visaoGeralDaEmpresa, visaoGeralDaPlataforma } from "@/server/services/painel";

export const metadata: Metadata = { title: "Visão geral" };

const MES = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  month: "long",
  year: "numeric",
});

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-borda bg-superficie p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

async function VisaoDaEmpresa({ sessao, empresaId }: { sessao: Sessao; empresaId: string }) {
  const visao = await visaoGeralDaEmpresa(db, contextoDa(sessao), empresaId);
  const { leads } = visao;
  const mes = MES.format(new Date());

  if (leads.total === 0) {
    return (
      <EstadoVazio
        icone={<Flame aria-hidden="true" />}
        titulo="Seus leads vão aparecer aqui"
        descricao="Divulgue o formulário de captação: cada contato chega classificado em quente, morno ou frio, com a resposta sugerida pela IA."
        acao={
          pode(sessao.ator, "empresa:editar", empresaId) ? (
            <Link href="/configuracoes" className={classesDeBotao("contorno")}>
              Ver o link do formulário
            </Link>
          ) : undefined
        }
      />
    );
  }

  const percentualQuentes =
    leads.doPeriodo === 0 ? 0 : Math.round((leads.porClassificacao.quente / leads.doPeriodo) * 100);

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BlocoDeIndicador rotulo="Leads no mês" valor={leads.doPeriodo} detalhe={mes} />
        <BlocoDeIndicador
          rotulo="Quentes no mês"
          valor={leads.porClassificacao.quente}
          detalhe={`${percentualQuentes}% dos leads do mês`}
        />
        <BlocoDeIndicador
          rotulo="Negócios ganhos"
          valor={leads.porStatus.ganho}
          detalhe={`de ${leads.total} leads no total`}
        />
        <BlocoDeIndicador
          rotulo="Análises da IA no mês"
          valor={`${visao.analisesUsadas} / ${visao.limiteDeAnalises}`}
        >
          <MedidorDeConsumo usadas={visao.analisesUsadas} limite={visao.limiteDeAnalises} />
        </BlocoDeIndicador>
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Classificação dos leads do mês">
          <BarrasDeClassificacao contagem={leads.porClassificacao} total={leads.doPeriodo} />
        </Cartao>
        <Cartao titulo="Andamento de todos os leads">
          <BarrasDeAndamento contagem={leads.porStatus} total={leads.total} />
        </Cartao>
      </div>

      <Cartao titulo="Quentes mais recentes">
        {visao.quentesRecentes.length === 0 ? (
          <p className="text-sm text-texto-suave">Nenhum lead quente ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda">
            {visao.quentesRecentes.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-marca-texto"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{lead.nome}</span>
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
        <Link
          href="/leads?classificacao=quente"
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-marca-texto hover:underline"
        >
          Ver todos os quentes
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </Cartao>
    </div>
  );
}

async function VisaoDaPlataforma({ sessao }: { sessao: Sessao }) {
  const resumo = await visaoGeralDaPlataforma(db, contextoDa(sessao));
  const custo = custoEstimadoEmDolares(resumo.tokensEntradaNoMes, resumo.tokensSaidaNoMes);
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BlocoDeIndicador
          rotulo="Empresas ativas"
          valor={resumo.empresasAtivas}
          detalhe={`${resumo.empresasBloqueadas} bloqueada(s)`}
        />
        <BlocoDeIndicador
          rotulo="Usuários"
          valor={resumo.usuarios}
          detalhe={`${resumo.usuariosBloqueados} bloqueado(s)`}
        />
        <BlocoDeIndicador
          rotulo="Leads no mês"
          valor={resumo.leadsNoMes}
          detalhe={MES.format(new Date())}
        />
        <BlocoDeIndicador
          rotulo="Análises da IA no mês"
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
    <>
      <Cabecalho
        titulo={`Olá, ${primeiroNome}!`}
        descricao={empresa ? empresa.nome : "Administração da plataforma Brasa"}
      />
      {empresa ? (
        <VisaoDaEmpresa sessao={sessao} empresaId={empresa.empresaId} />
      ) : (
        <VisaoDaPlataforma sessao={sessao} />
      )}
    </>
  );
}
