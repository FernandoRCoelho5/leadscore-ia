import { describe, expect, it, vi } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import type { Env } from "@/env";

/** robots.txt e sitemap.xml: só a produção é indexável, e nela só as páginas públicas. */

const simulado = vi.hoisted(() => ({
  env: { URL_DO_APP: "https://brasa.exemplo.com.br" } as Partial<Env>,
}));

vi.mock("@/env", () => ({ env: simulado.env }));

describe("robots", () => {
  it("fora da produção (previews, local) bloqueia tudo", () => {
    simulado.env.VERCEL_ENV = "preview";
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });

    simulado.env.VERCEL_ENV = undefined;
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("em produção libera as páginas públicas e bloqueia as áreas logadas, a API e os formulários", () => {
    simulado.env.VERCEL_ENV = "production";
    const { rules, sitemap: endereco } = robots();

    expect(rules).toMatchObject({ userAgent: "*", allow: "/" });
    const bloqueados = Array.isArray(rules) ? [] : rules.disallow;
    expect(bloqueados).toEqual(
      expect.arrayContaining(["/api/", "/f/", "/convite/", "/painel", "/leads", "/admin"]),
    );
    expect(endereco).toBe("https://brasa.exemplo.com.br/sitemap.xml");
  });
});

describe("sitemap", () => {
  it("lista só as páginas públicas, com o endereço do app", () => {
    expect(sitemap().map((pagina) => pagina.url)).toEqual([
      "https://brasa.exemplo.com.br/",
      "https://brasa.exemplo.com.br/cadastro",
      "https://brasa.exemplo.com.br/login",
      "https://brasa.exemplo.com.br/politica-de-privacidade",
    ]);
  });
});
