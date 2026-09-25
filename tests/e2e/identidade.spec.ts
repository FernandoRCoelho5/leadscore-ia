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
