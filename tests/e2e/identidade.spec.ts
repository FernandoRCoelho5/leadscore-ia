import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/** Identidade Brasa no navegador: fonte Sora e temas claro/escuro vindos do cookie. */

const CREME = "rgb(255, 247, 240)";
const CARVAO = "rgb(28, 20, 18)";

async function usarTema(contexto: BrowserContext, tema: string) {
  await contexto.addCookies([{ name: "tema", value: tema, url: "http://localhost:3100/" }]);
}

async function coresDaPagina(pagina: Page) {
  return pagina.evaluate(() => ({
    tema: document.documentElement.dataset.tema,
    fundo: getComputedStyle(document.body).backgroundColor,
    texto: getComputedStyle(document.body).color,
  }));
}

test("a página inicial apresenta a marca de forma acessível", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("img", { name: "Brasa" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Seus leads mais quentes, primeiro." }),
  ).toBeVisible();
  const classificacoes = page.getByRole("list", { name: "Como a Brasa classifica os leads" });
  await expect(classificacoes.getByRole("listitem")).toHaveText(["Quente", "Morno", "Frio"]);
});

test("serve os ícones da marca", async ({ request, page }) => {
  for (const [caminho, tipo] of [
    ["/icon.svg", "image/svg+xml"],
    ["/apple-icon.png", "image/png"],
    ["/favicon.ico", "image/x-icon"],
  ] as const) {
    const resposta = await request.get(caminho);
    expect(resposta.status(), caminho).toBe(200);
    expect(resposta.headers()["content-type"], caminho).toContain(tipo);
  }

  await page.goto("/");
  await expect(page.locator('link[rel="icon"][href*="icon.svg"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test("carrega a fonte Sora", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  expect(await page.evaluate(() => document.fonts.check("16px Sora"))).toBe(true);
});

test("o tema padrão é o claro", async ({ page }) => {
  await page.goto("/");

  expect(await coresDaPagina(page)).toEqual({ tema: "claro", fundo: CREME, texto: CARVAO });
});

test("o cookie tema=escuro aplica o tema escuro já no HTML do servidor", async ({
  page,
  context,
}) => {
  await usarTema(context, "escuro");
  await page.goto("/");

  expect(await coresDaPagina(page)).toEqual({ tema: "escuro", fundo: CARVAO, texto: CREME });
});

test("cookie inválido cai no tema claro", async ({ page, context }) => {
  await usarTema(context, "<script>");
  await page.goto("/");

  expect((await coresDaPagina(page)).tema).toBe("claro");
});

test.describe("com o sistema operacional no modo escuro", () => {
  test.use({ colorScheme: "dark" });

  test("o tema 'sistema' fica escuro", async ({ page, context }) => {
    await usarTema(context, "sistema");
    await page.goto("/");

    expect((await coresDaPagina(page)).fundo).toBe(CARVAO);
  });

  test("sem escolha, continua claro (claro é o padrão do produto)", async ({ page }) => {
    await page.goto("/");

    expect((await coresDaPagina(page)).fundo).toBe(CREME);
  });
});
