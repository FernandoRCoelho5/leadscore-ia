import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { montarCsp, proxy } from "@/proxy";

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
