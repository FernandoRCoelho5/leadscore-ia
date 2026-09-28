import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { ehFormularioPublico, montarCsp, proxy } from "@/proxy";

describe("montarCsp", () => {
  const producao = montarCsp("abc", { desenvolvimento: false, https: true });

  it("em produção só permite scripts e tags de estilo com o nonce", () => {
    expect(producao).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(producao).toContain("style-src 'self' 'nonce-abc'");
    expect(producao).toContain("style-src-elem 'self' 'nonce-abc';");
    expect(producao).not.toContain("unsafe-eval");
  });

  it("libera 'unsafe-inline' apenas para atributos style", () => {
    const comUnsafeInline = producao.split("; ").filter((d) => d.includes("unsafe-inline"));

    expect(comUnsafeInline).toEqual(["style-src-attr 'unsafe-inline'"]);
  });

  it("bloqueia iframes, plugins e troca da URL base", () => {
    expect(producao).toContain("frame-ancestors 'none'");
    expect(producao).toContain("object-src 'none'");
    expect(producao).toContain("base-uri 'self'");
  });

  it("só força HTTPS quando a requisição já é HTTPS", () => {
    expect(producao).toContain("upgrade-insecure-requests");
    expect(montarCsp("abc", { desenvolvimento: false, https: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("em desenvolvimento libera eval e estilos inline exigidos pelo Next.js", () => {
    const dev = montarCsp("abc", { desenvolvimento: true, https: false });

    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("style-src 'self' 'unsafe-inline'");
  });
});

describe("iframe (D-028)", () => {
  it("só o formulário público pode ir em iframe, e só em sites HTTPS", () => {
    const formulario = montarCsp("abc", {
      desenvolvimento: false,
      https: true,
      incorporavel: true,
    });

    expect(formulario).toContain("frame-ancestors 'self' https:;");
    expect(formulario).not.toContain("http:");
  });

  it("em desenvolvimento, o formulário também pode ir em páginas do localhost", () => {
    const dev = montarCsp("abc", { desenvolvimento: true, https: false, incorporavel: true });

    expect(dev).toContain("frame-ancestors 'self' https: http://localhost:*");
  });

  it.each([
    ["/f/agencia-pixel", true],
    ["/f/", true],
    ["/f", false],
    ["/formularios", false],
    ["/painel", false],
    ["/login", false],
  ])("%s incorporável: %s", (caminho, esperado) => {
    expect(ehFormularioPublico(caminho)).toBe(esperado);
  });

  it("o proxy aplica a regra pelo caminho", () => {
    const formulario = proxy(new NextRequest("http://localhost/f/agencia-pixel"));
    const painel = proxy(new NextRequest("http://localhost/painel"));

    expect(formulario.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'self' https:",
    );
    // Sem cookie, o painel redireciona para o login; a página de login continua bloqueada.
    const login = proxy(new NextRequest("http://localhost/login"));
    expect(painel.status).toBe(307);
    expect(login.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});

describe("proxy", () => {
  const nonceDe = (csp: string | null) => csp?.match(/'nonce-([^']+)'/)?.[1];

  it("gera um nonce diferente a cada requisição", () => {
    const primeira = proxy(new NextRequest("http://localhost/"));
    const segunda = proxy(new NextRequest("http://localhost/"));

    const nonce1 = nonceDe(primeira.headers.get("Content-Security-Policy"));
    const nonce2 = nonceDe(segunda.headers.get("Content-Security-Policy"));

    expect(nonce1).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);
  });
});
