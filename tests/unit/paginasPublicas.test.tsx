import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DemonstracaoDeLeads } from "@/components/publico/DemonstracaoDeLeads";
import { RodapePublico } from "@/components/publico/EstruturaPublica";
import { IndicadorDeEtapas } from "@/components/ui/IndicadorDeEtapas";
import { Moldura } from "@/components/ui/TelaDeErro";

/** Componentes das páginas públicas (Etapa 3). */

describe("IndicadorDeEtapas", () => {
  const html = renderToStaticMarkup(
    <IndicadorDeEtapas etapas={["Conta criada", "Sua empresa", "Perfil do negócio"]} atual={1} />,
  );

  it("marca o passo atual para leitores de tela", () => {
    expect(html).toContain('aria-label="Progresso"');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="step"[^]*Sua empresa/);
  });

  it("o passo concluído é dito em palavras, não só pela cor ou pelo ícone", () => {
    expect(html).toContain('Conta criada<span class="sr-only"> (concluído)</span>');
    expect(html).not.toContain('Perfil do negócio<span class="sr-only"> (concluído)');
  });
});

describe("DemonstracaoDeLeads", () => {
  const html = renderToStaticMarkup(<DemonstracaoDeLeads />);

  it("é uma lista marcada como exemplo, com nota e classificação escritas", () => {
    expect(html).toContain('aria-label="Exemplo: leads chegando com a nota da IA"');
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain(
      '<span class="sr-only">88</span></span><span class="sr-only"> de 100</span>',
    );
    expect(html).toContain(">Quente</span>");
    expect(html).toContain(">Frio</span>");
  });

  it("só o lead quente tem a chama viva e o brilho", () => {
    expect(html.match(/animate-chama/g)).toHaveLength(1);
    expect(html.match(/shadow-brilho-quente/g)).toHaveLength(1);
  });
});

describe("RodapePublico", () => {
  it("leva ao cadastro ou ao painel e sempre à política de privacidade", () => {
    const visitante = renderToStaticMarkup(<RodapePublico logado={false} />);
    expect(visitante).toContain('href="/cadastro"');
    expect(visitante).toContain('href="/politica-de-privacidade"');

    const logado = renderToStaticMarkup(<RodapePublico logado />);
    expect(logado).toContain('href="/painel"');
    expect(logado).not.toContain('href="/cadastro"');
  });
});

describe("Moldura das telas de erro", () => {
  it("fora do painel traz o logotipo; o erro usa o carmim, nunca o laranja", () => {
    const html = renderToStaticMarkup(
      <Moldura
        comLogo
        tom="erro"
        icone={<svg />}
        titulo="Algo deu errado"
        descricao="Tente de novo."
      />,
    );
    expect(html).toContain('aria-label="Brasa, página inicial"');
    expect(html).toContain("bg-erro-fundo");
    expect(html).not.toContain("bg-quente-fundo");
  });

  it("dentro do painel fica sem logotipo", () => {
    const html = renderToStaticMarkup(
      <Moldura icone={<svg />} titulo="Página não encontrada" descricao="..." />,
    );
    expect(html).not.toContain("Brasa, página inicial");
    expect(html).toContain("bg-quente-fundo");
  });
});
