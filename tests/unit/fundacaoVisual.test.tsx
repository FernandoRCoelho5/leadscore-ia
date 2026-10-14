import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { MedidorDaNota } from "@/components/leads/MedidorDaNota";
import { Abas } from "@/components/ui/Abas";
import { EstadoDeErro, EstadoVazio } from "@/components/ui/Avisos";
import { classesDeBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { Carregando, Esqueleto } from "@/components/ui/Esqueleto";
import { NumeroAnimado } from "@/components/ui/NumeroAnimado";
import { Linha, Tabela, Td, Th } from "@/components/ui/Tabela";
import { ProvedorDeToasts } from "@/components/ui/Toasts";

/** Componentes da fundação visual (Etapa 2, D-033 e D-034). */

describe("NumeroAnimado", () => {
  it("conta com CSS e deixa o valor real para leitores de tela", () => {
    const html = renderToStaticMarkup(<NumeroAnimado valor={88} />);

    expect(html).toContain('aria-hidden="true" class="numero-animado" style="--valor:88"');
    expect(html).toContain('<span class="sr-only">88</span>');
  });

  it("valores com milhar ou decimais aparecem formatados, sem animação", () => {
    expect(renderToStaticMarkup(<NumeroAnimado valor={2450} />)).toContain(">2.450<");
    expect(renderToStaticMarkup(<NumeroAnimado valor={2.5} />)).toContain(">2,5<");
    expect(renderToStaticMarkup(<NumeroAnimado valor={2450} />)).not.toContain("numero-animado");
  });
});

describe("MedidorDaNota (termômetro)", () => {
  it("é um medidor com a nota e a classificação escritas", () => {
    const html = renderToStaticMarkup(<MedidorDaNota score={88} classificacao="quente" />);

    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="88"');
    expect(html).toContain('aria-valuetext="88 de 100, Quente"');
    expect(html).toContain("bg-(image:--escala-termica)");
    expect(html).toContain("animate-encher");
  });

  it("o gradiente cobre a escala inteira, e a barra mostra só até a nota", () => {
    const html = renderToStaticMarkup(<MedidorDaNota score={50} classificacao="morno" />);

    expect(html).toContain("width:50%");
    expect(html).toContain("background-size:200% 100%");
  });

  it("limita a nota entre 0 e 100", () => {
    const html = renderToStaticMarkup(<MedidorDaNota score={140} classificacao="quente" />);

    expect(html).toContain('aria-valuenow="100"');
  });
});

describe("BadgeClassificacao vivo", () => {
  it("a chama só se mexe no quente com vivo", () => {
    expect(renderToStaticMarkup(<BadgeClassificacao classificacao="quente" vivo />)).toContain(
      "animate-chama",
    );
    expect(renderToStaticMarkup(<BadgeClassificacao classificacao="quente" />)).not.toContain(
      "animate-chama",
    );
    expect(renderToStaticMarkup(<BadgeClassificacao classificacao="morno" vivo />)).not.toContain(
      "animate-chama",
    );
  });
});

describe("botões", () => {
  it("afundam ao clicar e o principal tem o brilho quente no hover", () => {
    expect(classesDeBotao("primaria")).toContain("active:scale-[0.97]");
    expect(classesDeBotao("primaria")).toContain("hover:after:opacity-100");
    expect(classesDeBotao("contorno")).not.toContain("after:shadow-brilho-quente");
  });
});

describe("Cartao", () => {
  it("com título, vira uma região nomeada pelo próprio título", () => {
    const html = renderToStaticMarkup(<Cartao titulo="Andamento">conteúdo</Cartao>);
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];

    expect(html).toMatch(/^<section/);
    expect(html).toContain(`<h2 id="${id}"`);
  });

  it("sem título é só uma caixa; o brilho quente é decorativo", () => {
    const html = renderToStaticMarkup(<Cartao quente>conteúdo</Cartao>);

    expect(html).toMatch(/^<div/);
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*animate-respirar/);
  });
});

describe("carregamento e estados", () => {
  it("o esqueleto é decorativo e a espera é anunciada uma vez", () => {
    expect(renderToStaticMarkup(<Esqueleto className="h-4" />)).toContain('aria-hidden="true"');

    const html = renderToStaticMarkup(
      <Carregando rotulo="Carregando os leads">
        <Esqueleto />
      </Carregando>,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("carregamento-atrasado");
    expect(html).toContain('<span class="sr-only">Carregando os leads</span>');
  });

  it("estado vazio convida ao próximo passo; o de erro é um alerta com texto claro", () => {
    const vazio = renderToStaticMarkup(
      <EstadoVazio icone={<svg />} titulo="Nenhum lead ainda" descricao="Divulgue o formulário." />,
    );
    expect(vazio).toContain("Nenhum lead ainda");
    expect(vazio).toContain("bg-quente-fundo");

    const erro = renderToStaticMarkup(<EstadoDeErro />);
    expect(erro).toContain('role="alert"');
    expect(erro).toContain("Não conseguimos carregar esta parte");
  });
});

describe("Tabela", () => {
  it("tem legenda para leitores de tela e cabeçalhos de coluna", () => {
    const html = renderToStaticMarkup(
      <Tabela legenda="Leads" cabecalho={<Th>Lead</Th>}>
        <Linha>
          <Td>Ana</Td>
        </Linha>
      </Tabela>,
    );

    expect(html).toContain('<caption class="sr-only">Leads</caption>');
    expect(html).toContain('<th scope="col"');
  });
});

describe("Abas", () => {
  it("segue o padrão de abas: só a ativa no Tab e os painéis ligados às abas", () => {
    const html = renderToStaticMarkup(
      <Abas
        rotulo="Seções"
        abas={[
          { id: "a", titulo: "Análise", conteudo: "um" },
          { id: "b", titulo: "Histórico", conteudo: "dois" },
        ]}
      />,
    );

    expect(html).toContain('role="tablist" aria-label="Seções"');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1);
    // O segundo painel começa oculto.
    expect(html).toMatch(/role="tabpanel"[^>]*hidden=""/);
  });
});

describe("ProvedorDeToasts", () => {
  it("a região de avisos existe desde o início, para os leitores de tela anunciarem", () => {
    const html = renderToStaticMarkup(
      <ProvedorDeToasts>
        <p>app</p>
      </ProvedorDeToasts>,
    );

    expect(html).toContain('role="status" aria-live="polite"');
  });
});
