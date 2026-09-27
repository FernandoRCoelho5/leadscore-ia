import { expect, test, type Page } from "@playwright/test";

import {
  cadastrar,
  clienteComEmpresa,
  consultar,
  emailUnico,
  novaPagina,
  problemasDeAcessibilidade,
} from "./apoio";

/**
 * Acessibilidade de todas as telas (verificador em tests/e2e/apoio.ts), no
 * computador e no celular. As telas públicas rodam sempre; as logadas, só com
 * E2E_COM_BANCO=1.
 */

async function conferir(page: Page, caminho: string) {
  await page.goto(caminho);
  expect(await problemasDeAcessibilidade(page), `problemas em ${caminho}`).toEqual([]);
}

test("o verificador acusa os problemas de uma página malfeita", async ({ page }) => {
  await page.setContent(`
    <html><body>
      <h1>Um</h1><h1>Dois</h1><h4>Pulou</h4>
      <input id="x"><input id="x">
      <button><svg></svg></button>
      <img src="/foto.png">
      <div style="width: 5000px">largo demais</div>
    </body></html>`);

  const problemas = await problemasDeAcessibilidade(page);

  expect(problemas).toEqual(
    expect.arrayContaining([
      "<html> sem o atributo lang",
      'id repetido: "x" (2 vezes)',
      "0 elementos <main> visíveis (deve haver 1)",
      expect.stringContaining("campo sem rótulo"),
      expect.stringContaining("botão ou link sem nome acessível"),
      "imagem sem alt: /foto.png",
      "2 títulos <h1> visíveis (deve haver 1)",
      expect.stringContaining("título pula de h1 para h4"),
      expect.stringContaining("rolagem lateral"),
    ]),
  );
});

const PUBLICAS = ["/", "/login", "/cadastro", "/esqueci-senha", "/uma-pagina-que-nao-existe"];

for (const [dispositivo, tamanho] of [
  ["computador", { width: 1366, height: 900 }],
  ["celular", { width: 390, height: 844 }],
] as const) {
  test.describe(`telas públicas no ${dispositivo}`, () => {
    test.use({ viewport: tamanho });
    for (const caminho of PUBLICAS) {
      test(`${caminho} não tem problemas de acessibilidade`, async ({ page }) => {
        await conferir(page, caminho);
      });
    }
  });
}

test("o link 'Pular para o conteúdo' é o primeiro do teclado e leva ao conteúdo", async ({
  browser,
}) => {
  test.skip(!process.env.E2E_COM_BANCO, "Precisa de banco (área logada).");
  const page = await novaPagina(browser);
  await clienteComEmpresa(page);

  await page.keyboard.press("Tab");
  const pular = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(pular).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#conteudo")).toBeFocused();
});

test("telas do cliente não têm problemas de acessibilidade", async ({ browser }) => {
  test.skip(!process.env.E2E_COM_BANCO, "Precisa de banco (área logada).");
  const page = await novaPagina(browser);
  const { empresaId } = await clienteComEmpresa(page);
  await consultar(
    `INSERT INTO leads (id, empresa_id, nome, email, consentimento_lgpd, status_analise,
                        score_atual, classificacao_atual)
     VALUES (gen_random_uuid(), $1, 'Lead Acessível', $2, true, 'concluida', 80, 'quente')`,
    [empresaId, emailUnico("lead-a11y")],
  );

  for (const caminho of ["/painel", "/leads", "/membros", "/configuracoes", "/perfil"]) {
    await conferir(page, caminho);
  }
  await page.goto("/leads");
  await page
    .getByRole("table", { name: "Leads" })
    .getByRole("link", { name: "Lead Acessível" })
    .click();
  await page.waitForURL(/\/leads\/[0-9a-f-]+$/);
  expect(await problemasDeAcessibilidade(page), "problemas no detalhe do lead").toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const caminho of ["/painel", "/leads", "/membros"]) {
    await conferir(page, caminho);
  }
});

test("telas da administração não têm problemas de acessibilidade", async ({ browser }) => {
  test.skip(!process.env.E2E_COM_BANCO, "Precisa de banco (área logada).");
  const page = await novaPagina(browser);
  const email = emailUnico("admin-a11y");
  await cadastrar(page, "Ana Acessível", email);
  await consultar("UPDATE usuarios SET papel_plataforma = 'admin' WHERE email = $1", [email]);

  try {
    for (const caminho of ["/painel", "/admin/empresas", "/admin/usuarios", "/admin/auditoria"]) {
      await conferir(page, caminho);
    }
    // Com um diálogo aberto, o conteúdo dele também é conferido.
    await page.goto("/admin/empresas");
    await page
      .getByRole("table")
      .getByRole("button", { name: /^Gerenciar/ })
      .first()
      .click();
    expect(await problemasDeAcessibilidade(page), "problemas no diálogo Gerenciar").toEqual([]);
    await page.goto("/admin/usuarios");
    await page
      .getByRole("table")
      .getByRole("button", { name: /^Gerenciar/ })
      .first()
      .click();
    expect(await problemasDeAcessibilidade(page), "problemas no diálogo Gerenciar usuário").toEqual(
      [],
    );
  } finally {
    await consultar("UPDATE usuarios SET bloqueado_em = now() WHERE email = $1", [email]);
  }
});
