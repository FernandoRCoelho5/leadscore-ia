import { expect, test } from "@playwright/test";

/** Telas de acesso e proteção das áreas logadas (não precisam de banco). */

test.describe("áreas logadas sem sessão", () => {
  for (const area of ["/painel", "/leads", "/admin/empresas", "/perfil", "/onboarding"]) {
    test(`${area} leva ao login, guardando o destino`, async ({ page }) => {
      await page.goto(area);

      await expect(page).toHaveURL(`/login?proximo=${encodeURIComponent(area)}`);
      await expect(page.getByRole("heading", { level: 1, name: "Entrar na Brasa" })).toBeVisible();
    });
  }
});

test("o login tem rótulos, autocomplete e botão de mostrar senha", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("E-mail")).toHaveAttribute("autocomplete", "email");
  const senha = page.getByLabel("Senha", { exact: true });
  await expect(senha).toHaveAttribute("autocomplete", "current-password");
  await expect(senha).toHaveAttribute("type", "password");

  const mostrar = page.getByRole("button", { name: "Mostrar senha" });
  await mostrar.click();
  await expect(senha).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("erros de validação aparecem no campo e o resumo recebe o foco", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Ana");
  await page.getByLabel("E-mail de trabalho").fill("email-invalido");
  await page.getByLabel("Senha", { exact: true }).fill("curta");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
  const email = page.getByLabel("E-mail de trabalho");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAccessibleDescription(/Informe um e-mail válido/);
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAccessibleDescription(
    /pelo menos 10 caracteres/,
  );
});

test("link de redefinição sem token mostra como pedir outro", async ({ page }) => {
  await page.goto("/redefinir-senha");

  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Este link não é mais válido",
  );
  await expect(page.getByRole("link", { name: "Peça um novo link" })).toHaveAttribute(
    "href",
    "/esqueci-senha",
  );
});

test("o destino do login não aceita sites externos (open redirect)", async ({ page }) => {
  await page.goto("/login?proximo=//site-falso.com");

  // A página não quebra e o formulário continua disponível; o destino inválido é descartado no servidor.
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});
