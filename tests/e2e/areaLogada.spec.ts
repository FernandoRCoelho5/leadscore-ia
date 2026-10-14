import { expect, test, type Page } from "@playwright/test";

import { clienteComEmpresa, consultar, leadQuenteAnalisado, novaPagina } from "./apoio";

/**
 * Área logada da reformulação (Etapa 4): menu recolhido, filtros no celular,
 * toasts e o andamento que volta para "Novo". Roda só com E2E_COM_BANCO=1; os
 * testes só inserem e alteram os próprios dados.
 */

test.skip(!process.env.E2E_COM_BANCO, "Defina E2E_COM_BANCO=1 para rodar os testes com banco.");

async function menuRecolhido(page: Page) {
  return page.locator("aside[data-recolhido]").getAttribute("data-recolhido");
}

test("o menu recolhido continua assim ao recarregar, e o nome do item vira dica", async ({
  browser,
}) => {
  const page = await novaPagina(browser);
  await clienteComEmpresa(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByRole("button", { name: "Recolher menu" }).click();
  expect(await menuRecolhido(page)).toBe("true");
  await page.reload();
  expect(await menuRecolhido(page)).toBe("true");

  // O link continua com o nome (leitores de tela), que aparece ao focar.
  const leads = page.locator("aside").getByRole("link", { name: "Leads", exact: true });
  await leads.focus();
  await expect(leads.locator(".rotulo-do-menu")).toHaveCSS("opacity", "1");

  await page.getByRole("button", { name: "Expandir menu" }).click();
  await page.reload();
  expect(await menuRecolhido(page)).toBe("false");
});

test("no celular, os filtros ficam atrás de 'Buscar e filtrar'", async ({ browser }) => {
  const page = await novaPagina(browser);
  await clienteComEmpresa(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/leads");

  const botao = page.getByRole("button", { name: /Buscar e filtrar/ });
  const filtros = page.getByRole("search", { name: "Filtrar leads" });
  await expect(botao).toHaveAttribute("aria-expanded", "false");
  await expect(filtros).toBeHidden();
  await botao.click();
  await expect(filtros).toBeVisible();

  // Com filtro aplicado, a lista volta com os filtros abertos.
  await filtros.getByLabel("Classificação").selectOption({ label: "Quente" });
  await filtros.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/classificacao=quente/);
  await expect(page.getByRole("button", { name: /Buscar e filtrar/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("detalhe: copiar a resposta avisa num toast, e o lead volta para Novo", async ({
  browser,
}) => {
  test.slow();
  const page = await novaPagina(browser);
  const { empresaId } = await clienteComEmpresa(page);
  const id = await leadQuenteAnalisado(empresaId, "Quente Toast E2E");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/painel");
  // O destaque leva à lista já filtrada.
  await expect(
    page.getByRole("heading", { name: "1 lead quente esperando resposta" }),
  ).toBeVisible();

  await page.goto(`/leads/${id}`);
  await page.getByRole("button", { name: "Copiar resposta" }).click();
  await expect(
    page.getByRole("status").getByText("Resposta copiada.", { exact: false }),
  ).toBeVisible();

  const etapa = page.getByLabel("Etapa atual");
  await etapa.selectOption({ label: "Em contato" });
  await page.getByRole("button", { name: "Salvar andamento" }).click();
  await expect(page.getByText("Andamento atualizado.")).toBeVisible();
  await etapa.selectOption({ label: "Novo" });
  await page.getByRole("button", { name: "Salvar andamento" }).click();
  // O primeiro aviso ainda está na tela: espera o segundo, do novo salvamento.
  await expect(page.getByText("Andamento atualizado.")).toHaveCount(2);

  const [lead] = await consultar<{ status: string }>("SELECT status FROM leads WHERE id = $1", [
    id,
  ]);
  expect(lead?.status).toBe("novo");
});
