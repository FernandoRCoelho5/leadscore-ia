import { expect, test, type Page } from "@playwright/test";

import {
  unico,
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

/**
 * Texto do tamanho máximo que o banco aceita, com um sufixo único: as listas
 * precisam truncar sem criar rolagem lateral, seja qual for o conteúdo.
 */
function longo(prefixo: string, tamanho: number) {
  const sufixo = unico("").slice(-12);
  return (
    `${prefixo} ${"Extraordinariamente".repeat(10)}`.slice(0, tamanho - sufixo.length) + sufixo
  );
}

/**
 * Nas telas do painel, o conteúdo chega depois do esqueleto (loading.tsx),
 * que não tem títulos: o verificador espera o título da tela aparecer, para
 * conferir a tela de verdade. (O `aria-busy` não serve de sinal: o catálogo
 * mostra o componente de carregamento como exemplo.)
 */
async function semCarregamento(page: Page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

async function conferir(page: Page, caminho: string) {
  await page.goto(caminho);
  await semCarregamento(page);
  const { width } = page.viewportSize() ?? { width: 0 };
  expect(await problemasDeAcessibilidade(page), `problemas em ${caminho} (${width}px)`).toEqual([]);
}

/**
 * Larguras nos limites dos pontos de quebra (o padrão do Playwright, 1280 px,
 * é o xl): lg (1024, já com o menu lateral e o espaço mais apertado), md (768,
 * tabela sem menu) e celular. Com textos no tamanho máximo, é onde as tabelas
 * e os cartões passam da tela.
 */
const LARGURAS_MENORES = [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 360, height: 780 },
];

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

const PUBLICAS = [
  "/",
  "/login",
  "/cadastro",
  "/esqueci-senha",
  "/politica-de-privacidade",
  "/uma-pagina-que-nao-existe",
];

for (const [dispositivo, tamanho] of [
  ["computador", { width: 1366, height: 900 }],
  ["celular", { width: 360, height: 780 }],
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
  // Fluxo com várias pessoas e muitas idas ao servidor: no CI, longe do banco, passa de 30 s.
  test.slow();
  test.skip(!process.env.E2E_COM_BANCO, "Precisa de banco (área logada).");
  const page = await novaPagina(browser);
  const { empresaId } = await clienteComEmpresa(page);
  await consultar(
    `INSERT INTO leads (id, empresa_id, nome, email, consentimento_lgpd, status_analise,
                        score_atual, classificacao_atual)
     VALUES (gen_random_uuid(), $1, 'Lead Acessível', $2, true, 'concluida', 80, 'quente')`,
    [empresaId, emailUnico("lead-a11y")],
  );
  // Um lead com tudo no tamanho máximo, ainda sem análise (o selo mais largo).
  const [leadLongo] = await consultar<{ id: string }>(
    `INSERT INTO leads (id, empresa_id, nome, email, empresa_nome, consentimento_lgpd)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
     RETURNING id`,
    [
      empresaId,
      longo("Lead", 120),
      `${longo("contato", 60).toLowerCase()}@teste.brasa.example`,
      longo("Empresa do lead", 160),
    ],
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
  await semCarregamento(page);
  expect(await problemasDeAcessibilidade(page), "problemas no detalhe do lead").toEqual([]);

  for (const tamanho of LARGURAS_MENORES) {
    await page.setViewportSize(tamanho);
    // O detalhe do lead longo: o e-mail sem espaços não pode passar da tela.
    for (const caminho of ["/painel", "/leads", "/membros", `/leads/${leadLongo?.id}`]) {
      await conferir(page, caminho);
    }
    // Nos quentes recentes, o nome divide a linha com selo, nota e data e não pode sumir.
    await page.goto("/painel");
    await expect(
      page
        .locator("section", {
          has: page.getByRole("heading", { name: "Quentes mais recentes" }),
        })
        .getByText("Lead Acessível", { exact: true }),
      `nome do lead nos quentes recentes (${tamanho.width}px)`,
    ).toBeVisible();
  }
});

test("telas da administração não têm problemas de acessibilidade", async ({ browser }) => {
  // Fluxo com várias pessoas e muitas idas ao servidor: no CI, longe do banco, passa de 30 s.
  test.slow();
  test.skip(!process.env.E2E_COM_BANCO, "Precisa de banco (área logada).");
  const page = await novaPagina(browser);
  const email = emailUnico("admin-a11y");
  await cadastrar(page, "Ana Acessível", email);
  await consultar("UPDATE usuarios SET papel_plataforma = 'admin' WHERE email = $1", [email]);
  // Nomes no tamanho máximo, para conferir o truncamento nas tabelas.
  await consultar("INSERT INTO empresas (id, nome, slug) VALUES (gen_random_uuid(), $1, $2)", [
    longo("Empresa", 120),
    longo("slug", 60)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-"),
  ]);
  await consultar("INSERT INTO usuarios (id, nome, email) VALUES (gen_random_uuid(), $1, $2)", [
    longo("Pessoa", 120),
    `${longo("pessoa", 60).toLowerCase()}@teste.brasa.example`,
  ]);

  const listas = [
    `/admin/empresas?busca=${encodeURIComponent("Empresa Extraordinariamente")}`,
    `/admin/usuarios?busca=${encodeURIComponent("Pessoa Extraordinariamente")}`,
    "/admin/auditoria",
    // Catálogo: todos os componentes, nos dois temas lado a lado.
    "/admin/componentes",
  ];

  try {
    for (const caminho of ["/painel", ...listas]) {
      await conferir(page, caminho);
    }
    for (const tamanho of LARGURAS_MENORES) {
      await page.setViewportSize(tamanho);
      for (const caminho of listas) {
        await conferir(page, caminho);
      }
    }
    await page.setViewportSize({ width: 1280, height: 720 });
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
