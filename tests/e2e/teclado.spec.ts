import { expect, test, type Page } from "@playwright/test";

import { clienteComEmpresa, leadQuenteAnalisado, novaPagina } from "./apoio";

/**
 * Navegação só pelo teclado (WCAG 2.1.1 e 2.4.7): cada fluxo da área logada
 * com Tab, Enter e Esc, conferindo em toda parada que o foco está visível.
 * Roda só com E2E_COM_BANCO=1; nada é gravado além da conta do próprio teste.
 */

test.skip(!process.env.E2E_COM_BANCO, "Defina E2E_COM_BANCO=1 para rodar os testes com banco.");

type Foco = { nome: string; visivel: boolean; dentro: string | null };

/** O que está com o foco agora, se o anel de foco aparece e em que região (diálogo, gaveta). */
async function focoAtual(page: Page): Promise<Foco> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) {
      return { nome: "", visivel: false, dentro: null };
    }
    const estilo = getComputedStyle(el);
    const nome = (el.getAttribute("aria-label") ?? el.textContent ?? "")
      .trim()
      .replace(/\s+/g, " ");
    return {
      nome,
      visivel: estilo.outlineStyle !== "none" && parseFloat(estilo.outlineWidth) > 0,
      dentro: el.closest("dialog[open]") ? "dialogo" : el.closest("#menu-movel") ? "gaveta" : null,
    };
  });
}

/** Aperta Tab até chegar no elemento com esse nome; toda parada precisa mostrar o foco. */
async function tabAte(page: Page, nome: RegExp, limite = 60): Promise<Foco> {
  for (let vez = 0; vez < limite; vez += 1) {
    await page.keyboard.press("Tab");
    const foco = await focoAtual(page);
    expect(foco.visivel, `foco sem anel visível em "${foco.nome}"`).toBe(true);
    if (nome.test(foco.nome)) {
      return foco;
    }
  }
  throw new Error(`o Tab não chegou em ${nome}`);
}

test("menu lateral, menu da conta e recolher o menu, só pelo teclado", async ({ browser }) => {
  const page = await novaPagina(browser);
  await clienteComEmpresa(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/painel");

  await tabAte(page, /^Leads$/);
  await page.keyboard.press("Enter");
  await page.waitForURL("**/leads");
  await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();

  // Menu da conta: Enter abre, Tab entra, Esc fecha e devolve o foco.
  await tabAte(page, /Abrir o menu da conta/);
  await page.keyboard.press("Enter");
  await expect(page.locator("#menu-da-conta")).toBeVisible();
  await tabAte(page, /Alterar perfil/, 5);
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu-da-conta")).toBeHidden();
  expect((await focoAtual(page)).nome).toMatch(/Abrir o menu da conta/);

  // Recolher e expandir: o foco fica no botão, que diz o que vai fazer. O
  // botão fica no fim do menu lateral, que vem antes do cabeçalho na página:
  // o percurso recomeça do topo.
  await page.goto("/leads");
  await tabAte(page, /Recolher menu/);
  await page.keyboard.press("Enter");
  await expect(page.locator("aside[data-recolhido=true]")).toBeAttached();
  expect((await focoAtual(page)).nome).toMatch(/Expandir menu/);
  await page.keyboard.press("Enter");
  await expect(page.locator("aside[data-recolhido=false]")).toBeAttached();
});

test("detalhe do lead: copiar e o diálogo de exclusão, só pelo teclado", async ({ browser }) => {
  test.slow();
  const page = await novaPagina(browser);
  const { empresaId } = await clienteComEmpresa(page);
  const id = await leadQuenteAnalisado(empresaId, "Lead Teclado E2E");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/leads/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Lead Teclado E2E" })).toBeVisible();

  await tabAte(page, /^Copiar resposta$/);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Resposta copiada.", { exact: false })).toBeVisible();

  // Diálogo: o foco entra e não volta para a página por trás (que fica inerte).
  // Depois do último botão, o navegador leva o foco à barra de endereço, e não
  // à página: é o padrão do <dialog> modal, sem prender o teclado de vez.
  await tabAte(page, /^Excluir lead$/);
  await page.keyboard.press("Enter");
  const dialogo = page.getByRole("dialog", { name: "Excluir este lead?" });
  await expect(dialogo).toBeVisible();
  for (let vez = 0; vez < 4; vez += 1) {
    const foco = await focoAtual(page);
    expect(
      foco.dentro === "dialogo" || foco.nome === "",
      `foco fora do diálogo: "${foco.nome}"`,
    ).toBe(true);
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  expect((await focoAtual(page)).nome).toMatch(/^Excluir lead$/);
});

test("celular: gaveta do menu e filtros, só pelo teclado", async ({ browser }) => {
  const page = await novaPagina(browser);
  await clienteComEmpresa(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/leads");

  await tabAte(page, /^Abrir menu$/);
  await page.keyboard.press("Enter");
  await expect(page.locator("#menu-movel")).toBeVisible();
  await page.keyboard.press("Tab");
  expect((await focoAtual(page)).dentro).toBe("gaveta");
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu-movel")).toBeHidden();
  expect((await focoAtual(page)).nome).toBe("Abrir menu");

  await tabAte(page, /Buscar e filtrar/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Buscar e filtrar/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Buscar")).toBeFocused();
});
