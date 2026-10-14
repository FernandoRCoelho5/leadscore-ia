import { Inbox, Settings } from "lucide-react";
import type { Metadata } from "next";

import { Amostra } from "@/components/catalogo/Amostra";
import { Interativos } from "@/components/catalogo/Interativos";
import { Vitrine } from "@/components/catalogo/Vitrine";
import { SeloDeSituacao, SeloDoPapel } from "@/components/ui/Selos";
import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { MedidorDaNota } from "@/components/leads/MedidorDaNota";
import { Cabecalho } from "@/components/painel/Cabecalho";
import { FiltrosRecolhiveis } from "@/components/painel/FiltrosRecolhiveis";
import { BarrasDeClassificacao, BlocoDeIndicador } from "@/components/painel/Indicadores";
import { QuentesSemResposta } from "@/components/painel/QuentesSemResposta";
import { Abas } from "@/components/ui/Abas";
import { Alerta, EstadoDeErro, EstadoVazio, ResumoDeErros } from "@/components/ui/Avisos";
import { Botao } from "@/components/ui/Botao";
import { AreaDeTexto, CaixaDeMarcacao, CampoTexto, Selecao } from "@/components/ui/Campo";
import { Cartao } from "@/components/ui/Cartao";
import { Dialogo } from "@/components/ui/Dialogo";
import { Carregando, EsqueletoDeIndicadores, EsqueletoDeLista } from "@/components/ui/Esqueleto";
import { NumeroAnimado } from "@/components/ui/NumeroAnimado";
import { Linha, Tabela, Td, Th } from "@/components/ui/Tabela";
import { ConteudoQueChega } from "@/components/ui/Revelacao";
import type { Classificacao } from "@/db/schema";
import { exigirPermissao } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Componentes" };

const LEADS_DE_EXEMPLO: {
  nome: string;
  empresa: string;
  classificacao: Classificacao;
  nota: number;
}[] = [
  { nome: "Juliana Castro", empresa: "Distribuidora Vale Sul", classificacao: "quente", nota: 88 },
  { nome: "Bruno Tavares", empresa: "Clínica OdontoVida", classificacao: "morno", nota: 64 },
  { nome: "Ana Beatriz Souza", empresa: "—", classificacao: "frio", nota: 18 },
];

/**
 * Catálogo dos componentes da interface (D-035), para a equipe revisar o
 * design nos dois temas e com movimento reduzido. Só exemplos fixos: a página
 * não lê nem grava dados. Admin e suporte (`catalogo:ver`).
 */
export default async function PaginaComponentes() {
  await exigirPermissao("catalogo:ver");

  return (
    <ConteudoQueChega>
      <Cabecalho
        titulo="Componentes"
        descricao="Componentes base da Brasa nos temas claro e escuro. Exemplos fixos: nada aqui lê ou grava dados."
      />
      <Vitrine>
        <Amostra
          titulo="Botões"
          descricao="Afundam ao clicar; o principal ganha o brilho quente no hover. Carregando bloqueia novos cliques."
        >
          {() => (
            <div className="flex flex-wrap gap-2">
              <Botao>Principal</Botao>
              <Botao variante="secundaria">Secundário</Botao>
              <Botao variante="contorno">Contorno</Botao>
              <Botao variante="fantasma">Fantasma</Botao>
              <Botao variante="destrutivo">Destrutivo</Botao>
              <Botao carregando>Salvando</Botao>
              <Botao disabled>Desabilitado</Botao>
            </div>
          )}
        </Amostra>

        <Amostra titulo="Campos" descricao="Rótulo sempre visível; ajuda e erro ligados ao campo.">
          {(tema) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoTexto
                id={`catalogo-nome-${tema}`}
                rotulo="Seu nome"
                ajuda="Como você quer ser chamado."
              />
              <CampoTexto
                id={`catalogo-email-${tema}`}
                rotulo="E-mail"
                type="email"
                defaultValue="ana@"
                erro="Informe um e-mail válido, como nome@empresa.com.br."
              />
              <Selecao
                id={`catalogo-segmento-${tema}`}
                rotulo="Segmento"
                opcional
                textoVazio="Escolha um segmento"
                opcoes={["Agência", "Consultoria", "Software"]}
              />
              <AreaDeTexto id={`catalogo-mensagem-${tema}`} rotulo="Mensagem" rows={2} />
              <CaixaDeMarcacao
                id={`catalogo-aceite-${tema}`}
                rotulo="Concordo com o uso dos meus dados para este contato."
                className="sm:col-span-2"
              />
            </div>
          )}
        </Amostra>

        <Amostra
          titulo="Classificação e selos"
          descricao="Sempre ícone, palavra e cor. A chama viva (vivo) fica para os destaques, não para listas."
        >
          {() => (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <BadgeClassificacao classificacao="quente" vivo />
                <BadgeClassificacao classificacao="quente" />
                <BadgeClassificacao classificacao="morno" />
                <BadgeClassificacao classificacao="frio" />
                <BadgeClassificacao classificacao={null} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SeloDeSituacao bloqueado={false} rotulo="Ativa" />
                <SeloDeSituacao bloqueado rotulo="Bloqueada" />
                <SeloDoPapel papel="admin" />
                <SeloDoPapel papel="suporte" />
                <SeloDoPapel papel="cliente" />
              </div>
            </div>
          )}
        </Amostra>

        <Amostra
          titulo="Nota da IA e números"
          descricao="O termômetro enche e o número conta ao aparecer (CSS, sem JavaScript). Com movimento reduzido, aparecem prontos."
        >
          {() => (
            <div className="flex flex-col gap-5">
              <MedidorDaNota score={92} classificacao="quente" />
              <MedidorDaNota score={58} classificacao="morno" />
              <MedidorDaNota score={18} classificacao="frio" />
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[
                  ["Leads no mês", 128],
                  ["Quentes", 37],
                  ["No total", 2450],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="rounded-lg border border-borda bg-superficie p-3">
                    <dt className="text-xs text-texto-suave">{rotulo}</dt>
                    <dd className="text-2xl font-bold">
                      <NumeroAnimado valor={Number(valor)} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Amostra>

        <Amostra titulo="Cartões" descricao="O brilho que respira é só do que é urgente.">
          {() => (
            <div className="grid gap-4 sm:grid-cols-2">
              <Cartao titulo="Andamento" descricao="Todos os leads">
                <p className="text-sm text-texto-suave">Conteúdo do cartão.</p>
              </Cartao>
              <Cartao titulo="Juliana Castro" descricao="Chegou há 3 minutos" quente>
                <BadgeClassificacao classificacao="quente" vivo />
              </Cartao>
            </div>
          )}
        </Amostra>

        <Amostra titulo="Tabela">
          {(tema) => (
            <Tabela
              legenda={`Leads de exemplo, tema ${tema}`}
              cabecalho={
                <>
                  <Th>Lead</Th>
                  <Th className="w-40">Classificação</Th>
                </>
              }
            >
              {LEADS_DE_EXEMPLO.map((lead) => (
                <Linha key={lead.nome}>
                  <Td>
                    <p className="truncate font-semibold">{lead.nome}</p>
                    <p className="truncate text-texto-suave">{lead.empresa}</p>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <BadgeClassificacao classificacao={lead.classificacao} />
                      <span className="font-semibold tabular-nums">{lead.nota}</span>
                    </span>
                  </Td>
                </Linha>
              ))}
            </Tabela>
          )}
        </Amostra>

        <Amostra
          titulo="Alertas"
          descricao="Sempre com ícone e texto; o erro nunca usa o laranja da marca."
        >
          {() => (
            <div className="flex flex-col gap-3">
              <Alerta tipo="sucesso">Perfil salvo.</Alerta>
              <Alerta tipo="erro">Não conseguimos salvar. Tente de novo.</Alerta>
              <ResumoDeErros
                mensagem="Confira os campos destacados."
                erros={{ nome: "Informe o seu nome.", email: "Informe um e-mail válido." }}
                refResumo={null}
              />
            </div>
          )}
        </Amostra>

        <Amostra
          titulo="Carregamento, vazio e erro"
          descricao="O esqueleto só aparece se a espera passar de 300 ms; o vazio convida ao próximo passo."
        >
          {() => (
            <div className="flex flex-col gap-4">
              <Carregando rotulo="Carregando os leads">
                <div className="flex flex-col gap-4">
                  <EsqueletoDeIndicadores quantidade={2} />
                  <EsqueletoDeLista linhas={2} />
                </div>
              </Carregando>
              <EstadoVazio
                icone={<Inbox aria-hidden="true" />}
                titulo="Nenhum lead ainda"
                descricao="Divulgue o formulário: cada contato chega aqui já com a nota da IA."
                acao={<Botao variante="contorno">Copiar o link do formulário</Botao>}
              />
              <EstadoDeErro acao={<Botao variante="contorno">Tentar de novo</Botao>} />
            </div>
          )}
        </Amostra>

        <Amostra
          titulo="Visão geral"
          descricao="O destaque dos quentes sem resposta é o único brilho da tela. Os blocos entram em sequência, os números contam e as barras enchem."
        >
          {() => (
            <div className="flex flex-col gap-4">
              <QuentesSemResposta quantidade={3} />
              <dl className="grid gap-4 sm:grid-cols-2">
                <BlocoDeIndicador ordem={0} rotulo="Leads nos últimos 30 dias" valor={42} />
                <BlocoDeIndicador ordem={1} rotulo="Análises da IA em outubro" valor="38 / 100" />
              </dl>
              <BarrasDeClassificacao
                contagem={{ quente: 9, morno: 17, frio: 12, semAnalise: 4 }}
                total={42}
              />
            </div>
          )}
        </Amostra>

        <Amostra
          titulo="Filtros das listas"
          descricao="No celular, ficam atrás de “Buscar e filtrar” (abertos com filtro aplicado). Diminua a janela para ver."
        >
          {(tema) => (
            <FiltrosRecolhiveis temFiltro={false}>
              <div className="rounded-lg border border-borda bg-superficie p-4">
                <CampoTexto id={`catalogo-busca-${tema}`} rotulo="Buscar" type="search" />
              </div>
            </FiltrosRecolhiveis>
          )}
        </Amostra>

        <Amostra titulo="Abas" descricao="Setas, Home e End trocam de aba; o indicador desliza.">
          {() => (
            <Abas
              rotulo="Seções do lead"
              abas={[
                {
                  id: "analise",
                  titulo: "Análise",
                  conteudo: <p className="text-sm">Justificativa e resposta sugerida.</p>,
                },
                {
                  id: "historico",
                  titulo: "Histórico",
                  conteudo: <p className="text-sm">Análises anteriores do lead.</p>,
                },
                {
                  id: "contato",
                  titulo: "Contato",
                  conteudo: <p className="text-sm">E-mail, telefone e empresa.</p>,
                },
              ]}
            />
          )}
        </Amostra>

        <Amostra
          titulo="Modais, toasts e feedback"
          descricao="Modais e menus surgem e somem só com CSS. Toasts de erro não somem sozinhos."
        >
          {(tema) => (
            <div className="flex flex-col gap-5">
              <Dialogo
                rotuloDoGatilho="Abrir modal"
                complementoDoGatilho={`no tema ${tema}`}
                iconeDoGatilho={<Settings aria-hidden="true" className="size-4" />}
                titulo="Gerenciar empresa"
                descricao="Exemplo de modal com o <dialog> nativo."
              >
                <p className="text-sm text-texto-suave">Fecha com Esc, no X ou ao confirmar.</p>
              </Dialogo>
              <Interativos tema={tema} />
            </div>
          )}
        </Amostra>
      </Vitrine>
    </ConteudoQueChega>
  );
}
