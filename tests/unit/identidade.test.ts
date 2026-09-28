import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { lerTema, TEMA_PADRAO } from "@/lib/tema";

/**
 * Garante a acessibilidade da identidade Brasa: lê os tokens do globals.css,
 * resolve cada um nos temas claro e escuro e confere o contraste WCAG 2.2.
 * Se alguém alterar uma cor e quebrar o contraste mínimo, o CI reprova.
 */

const css = readFileSync("src/app/globals.css", "utf8");

/** Escalas da marca: nome-passo -> hex (ex.: "brasa-600" -> "#d63a00"). */
const escalas = new Map(
  [...css.matchAll(/--color-([a-z]+-\d+|white|black):\s*(#[0-9a-f]{6});/gi)].map((m) => [
    m[1] ?? "",
    (m[2] ?? "").toLowerCase(),
  ]),
);

/** Extrai as variáveis semânticas de um bloco (ex.: `:root {`), resolvendo para hex. */
function tokensDoBloco(inicioDoBloco: string): Map<string, string> {
  const inicio = css.indexOf(inicioDoBloco);
  expect(inicio, `bloco ${inicioDoBloco} não encontrado`).toBeGreaterThan(-1);
  const corpo = css.slice(inicio, css.indexOf("}", inicio));
  return new Map(
    [...corpo.matchAll(/--([a-z0-9-]+):\s*var\(--color-([a-z0-9-]+)\);/g)].map((m) => {
      const hex = escalas.get(m[2] ?? "");
      if (!hex) {
        throw new Error(`cor --color-${m[2]} não existe nas escalas`);
      }
      return [m[1] ?? "", hex];
    }),
  );
}

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = canais.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [clara, escura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return ((clara ?? 0) + 0.05) / ((escura ?? 0) + 0.05);
}

const TEXTO = 4.5; // texto comum (WCAG 1.4.3)
const GRAFICO = 3; // ícones, bordas de campo, foco e gráficos (WCAG 1.4.11)

/** [primeiro plano, fundo, mínimo] em nomes de tokens semânticos. */
const PARES: [string, string, number][] = [
  ["texto", "fundo", TEXTO],
  ["texto", "superficie", TEXTO],
  ["texto-suave", "fundo", TEXTO],
  ["texto-suave", "superficie", TEXTO],
  ["texto-suave", "superficie-2", TEXTO],
  ["texto-primaria", "primaria", TEXTO],
  ["texto-primaria", "primaria-hover", TEXTO],
  ["marca-texto", "fundo", TEXTO],
  ["marca-texto", "superficie", TEXTO],
  // Item ativo do menu lateral.
  ["marca-texto", "superficie-2", TEXTO],
  ["texto-secundaria", "secundaria", TEXTO],
  ["erro", "superficie", TEXTO],
  ["erro-alerta", "erro-fundo", TEXTO],
  ["texto-destrutivo", "destrutivo", TEXTO],
  ["sucesso", "sucesso-fundo", TEXTO],
  ["quente-texto", "quente-fundo", TEXTO],
  ["morno-texto", "morno-fundo", TEXTO],
  ["frio-texto", "frio-fundo", TEXTO],
  ["borda-campo", "fundo", GRAFICO],
  ["borda-campo", "superficie", GRAFICO],
  ["foco", "fundo", GRAFICO],
  ["foco", "superficie", GRAFICO],
  ["destaque", "superficie", GRAFICO],
  ["quente-icone", "quente-fundo", GRAFICO],
  ["morno-icone", "morno-fundo", GRAFICO],
  ["frio-icone", "frio-fundo", GRAFICO],
  ["quente-grafico", "superficie", GRAFICO],
  ["morno-grafico-contorno", "superficie", GRAFICO],
  ["frio-grafico", "superficie", GRAFICO],
];

const TEMAS = {
  claro: tokensDoBloco(":root {"),
  escuro: tokensDoBloco('[data-tema="escuro"] {'),
};

describe.each(Object.entries(TEMAS))("contraste do tema %s", (_, tokens) => {
  it.each(PARES)("%s sobre %s atinge %s:1", (frente, fundo, minimo) => {
    const corDaFrente = tokens.get(frente);
    const corDoFundo = tokens.get(fundo);
    expect(corDaFrente, `token ${frente} ausente`).toBeDefined();
    expect(corDoFundo, `token ${fundo} ausente`).toBeDefined();

    expect(contraste(corDaFrente ?? "", corDoFundo ?? "")).toBeGreaterThanOrEqual(minimo);
  });
});

describe("temas", () => {
  it("o modo 'sistema' escuro usa exatamente os mesmos tokens do tema escuro", () => {
    expect(tokensDoBloco('[data-tema="sistema"] {')).toEqual(TEMAS.escuro);
  });

  it("os dois temas definem os mesmos tokens", () => {
    expect([...TEMAS.escuro.keys()].sort()).toEqual([...TEMAS.claro.keys()].sort());
  });

  it("o laranja da marca (#FF5A1F) não passa como texto comum no branco", () => {
    // Documenta a regra: #FF5A1F só em ícones, destaques e texto grande.
    expect(contraste("#ff5a1f", "#ffffff")).toBeLessThan(TEXTO);
  });
});

describe("lerTema", () => {
  it("aceita os temas válidos", () => {
    expect(lerTema("claro")).toBe("claro");
    expect(lerTema("escuro")).toBe("escuro");
    expect(lerTema("sistema")).toBe("sistema");
  });

  it("usa o tema claro quando o cookie está ausente ou é inválido", () => {
    expect(TEMA_PADRAO).toBe("claro");
    expect(lerTema(undefined)).toBe("claro");
    expect(lerTema("<script>")).toBe("claro");
  });
});
