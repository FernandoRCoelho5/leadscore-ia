import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { Logo } from "@/components/marca/Logo";

describe("BadgeClassificacao", () => {
  it.each([
    ["quente", "Quente", "bg-quente-fundo"],
    ["morno", "Morno", "bg-morno-fundo"],
    ["frio", "Frio", "bg-frio-fundo"],
  ] as const)("%s mostra a palavra, o ícone e a cor", (classificacao, rotulo, cor) => {
    const html = renderToStaticMarkup(<BadgeClassificacao classificacao={classificacao} />);

    expect(html).toContain(`>${rotulo}</span>`);
    expect(html).toContain(cor);
    // O ícone é decorativo: a informação está na palavra (não só na cor ou no ícone).
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("lead sem análise tem um badge neutro", () => {
    const html = renderToStaticMarkup(<BadgeClassificacao classificacao={null} />);

    expect(html).toContain(">Sem análise</span>");
    expect(html).toContain("bg-superficie-2");
  });
});

describe("Logo", () => {
  it("tem nome acessível por padrão", () => {
    const html = renderToStaticMarkup(<Logo />);

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Brasa"');
  });

  it("fica oculto para leitores de tela quando é decorativo", () => {
    const html = renderToStaticMarkup(<Logo decorativo variante="simbolo" />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("aria-label");
  });

  it("o nome segue a cor do texto (tema claro ou escuro)", () => {
    expect(renderToStaticMarkup(<Logo />)).toContain('fill="currentColor"');
  });
});
