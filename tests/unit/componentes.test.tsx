import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormularioDeCaptacao } from "@/components/captacao/FormularioDeCaptacao";
import { BadgeClassificacao } from "@/components/leads/BadgeClassificacao";
import { Logo } from "@/components/marca/Logo";
import { codigoDeIncorporacao, enderecoDoFormulario } from "@/lib/incorporacao";

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

describe("FormularioDeCaptacao", () => {
  const html = renderToStaticMarkup(
    <FormularioDeCaptacao slug="agencia" nomeDaEmpresa="Agência Pixel" carimbo="123.abc" />,
  );

  it("tem rótulo visível em cada campo e marca os opcionais", () => {
    for (const id of ["nome", "email", "telefone", "empresaNome", "segmento", "mensagem"]) {
      expect(html).toContain(`for="${id}"`);
    }
    expect(html.match(/\(opcional\)/g)).toHaveLength(3);
  });

  it("usa os teclados e o preenchimento automático certos no celular", () => {
    expect(html).toMatch(/<input[^>]*type="email"[^>]*inputMode="email"[^>]*autoComplete="email"/);
    expect(html).toMatch(/<input[^>]*type="tel"[^>]*inputMode="tel"[^>]*autoComplete="tel"/);
  });

  it("o consentimento (LGPD) começa desmarcado", () => {
    const caixa = html.match(/<input[^>]*id="consentimento"[^>]*>/)?.[0];

    expect(caixa).toBeDefined();
    expect(caixa).not.toContain("checked");
    expect(caixa).toContain('value="sim"');
  });

  it("o campo-armadilha fica fora do alcance do teclado e dos leitores de tela", () => {
    expect(html).toMatch(/<div aria-hidden="true"[^>]*><label for="website">/);
    expect(html).toMatch(/<input id="website"[^>]*tabindex="-1"/i);
  });

  it("leva o carimbo assinado num campo oculto", () => {
    expect(html).toContain('<input type="hidden" name="carimbo" value="123.abc"/>');
  });
});

describe("codigoDeIncorporacao", () => {
  it("monta o iframe com título e escapa o nome da empresa", () => {
    const codigo = codigoDeIncorporacao(
      enderecoDoFormulario("https://app.brasa.example/", "pixel"),
      'Pixel & Cia "<script>"',
    );

    expect(codigo).toContain('src="https://app.brasa.example/f/pixel"');
    expect(codigo).toContain('title="Fale com Pixel &amp; Cia &quot;&lt;script&gt;&quot;"');
    expect(codigo).not.toContain("<script>");
  });
});
