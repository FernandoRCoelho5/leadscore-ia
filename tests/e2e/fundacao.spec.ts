import { expect, test } from "@playwright/test";

/**
 * Teste de fumaça da fundação: a aplicação sobe em modo produção, com os
 * cabeçalhos de segurança, a CSP funcionando e as rotas de API no formato
 * padronizado.
 */

test.describe("página inicial", () => {
  test("carrega em pt-BR sem nenhuma violação da CSP", async ({ page }) => {
    const violacoes: string[] = [];
    page.on("console", (mensagem) => {
      if (mensagem.type() === "error" && /Content Security Policy/i.test(mensagem.text())) {
        violacoes.push(mensagem.text());
      }
    });
    page.on("pageerror", (erro) => violacoes.push(erro.message));

    const resposta = await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(resposta?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page).toHaveTitle("Brasa");
    expect(violacoes).toEqual([]);
  });

  test("todos os scripts usam o nonce da requisição", async ({ page }) => {
    const resposta = await page.goto("/");
    if (resposta === null) {
      throw new Error("a página não respondeu");
    }

    const nonce = resposta.headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
    // O navegador esconde o atributo nonce do DOM, então a conferência é no HTML bruto.
    const scripts = (await resposta.text()).match(/<script\b[^>]*>/g) ?? [];

    expect(nonce).toBeTruthy();
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(script).toContain(`nonce="${nonce}"`);
    }
  });

  test("envia os cabeçalhos de segurança", async ({ request }) => {
    const cabecalhos = (await request.get("/")).headers();

    expect(cabecalhos["content-security-policy"]).toMatch(
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/,
    );
    expect(cabecalhos["content-security-policy"]).not.toContain("unsafe-eval");
    expect(cabecalhos["content-security-policy"]).toMatch(/style-src-elem 'self' 'nonce-[^']+'/);
    expect(cabecalhos["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(cabecalhos["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
    expect(cabecalhos["x-content-type-options"]).toBe("nosniff");
    expect(cabecalhos["x-frame-options"]).toBe("DENY");
    expect(cabecalhos["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(cabecalhos["x-powered-by"]).toBeUndefined();
  });
});

test.describe("formulário público (/f/...)", () => {
  test("só ele pode ir em iframe, e só em sites HTTPS", async ({ request }) => {
    // Endereço inexistente: a regra vale para todo o /f/, sem precisar de banco.
    const formulario = await request.get("/f/endereco-que-nao-existe");
    const login = await request.get("/login");

    expect(formulario.status()).toBe(404);
    expect(formulario.headers()["content-security-policy"]).toContain(
      "frame-ancestors 'self' https:",
    );
    expect(formulario.headers()["x-frame-options"]).toBeUndefined();
    expect(login.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(login.headers()["x-frame-options"]).toBe("DENY");
  });

  test("endereço inexistente mostra a página própria, sem violação da CSP", async ({ page }) => {
    const violacoes: string[] = [];
    page.on("console", (mensagem) => {
      if (mensagem.type() === "error" && /Content Security Policy/i.test(mensagem.text())) {
        violacoes.push(mensagem.text());
      }
    });

    await page.goto("/f/endereco-que-nao-existe");

    await expect(page.getByRole("heading", { name: "Formulário não encontrado" })).toBeVisible();
    await expect(page).toHaveTitle("Formulário não encontrado · Brasa");
    expect(violacoes).toEqual([]);
  });

  test("a API recusa JSON de outra origem e corpo que não é JSON", async ({ request }) => {
    const deOutraOrigem = await request.post("/api/publico/qualquer/leads", {
      headers: { origin: "https://golpe.example" },
      data: { nome: "x" },
    });
    const semJson = await request.post("/api/publico/qualquer/leads", {
      headers: { "content-type": "text/plain" },
      data: "nome=x",
    });

    expect(deOutraOrigem.status()).toBe(403);
    expect(semJson.status()).toBe(400);
    expect((await semJson.json()).erro.codigo).toBe("VALIDACAO");
  });
});

test("páginas cujo caminho começa com 'api' também recebem a CSP", async ({ request }) => {
  const resposta = await request.get("/apiario");

  expect(resposta.status()).toBe(404);
  expect(resposta.headers()["content-security-policy"]).toContain("'nonce-");
});

test.describe("API", () => {
  test("GET /api/saude responde ok sem cache", async ({ request }) => {
    const resposta = await request.get("/api/saude");

    expect(resposta.status()).toBe(200);
    expect(await resposta.json()).toEqual({ status: "ok" });
    expect(resposta.headers()["cache-control"]).toBe("no-store");
    expect(resposta.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("rota inexistente devolve 404 no formato padronizado", async ({ request }) => {
    const resposta = await request.post("/api/rota-que-nao-existe");
    const corpo = await resposta.json();

    expect(resposta.status()).toBe(404);
    expect(corpo).toEqual({
      erro: {
        codigo: "NAO_ENCONTRADO",
        mensagem: "Rota de API não encontrada.",
        requestId: resposta.headers()["x-request-id"],
      },
    });
  });
});
