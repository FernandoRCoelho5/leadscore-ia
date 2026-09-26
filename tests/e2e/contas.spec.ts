import { Pool } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { config } from "dotenv";

/**
 * Fluxos com banco de dados real: cadastro, onboarding, menu por perfil,
 * bloqueio de conta. Rodam só com E2E_COM_BANCO=1 (localmente, na branch de
 * desenvolvimento; no CI, na branch "e2e" do Neon). Os testes só inserem
 * dados, com e-mails únicos do domínio reservado .example.
 */

config({ path: ".env.local", quiet: true });

test.skip(!process.env.E2E_COM_BANCO, "Defina E2E_COM_BANCO=1 para rodar os testes com banco.");

const SENHA = "uma senha longa de teste";

/** IP fictício (faixa de documentação 203.0.113.0/24) para o limitador de tentativas. */
function ipFicticio() {
  return `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
}

// Em produção o limite de tentativas vale por IP. Cada teste usa um IP fictício
// diferente para os testes poderem rodar várias vezes seguidas.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ipFicticio() });
});

test("o login bloqueia tentativas em excesso do mesmo IP (força bruta)", async ({ request }) => {
  const cabecalhos = { "x-forwarded-for": ipFicticio(), origin: "http://localhost:3100" };
  const tentar = () =>
    request.post("/api/auth/sign-in/email", {
      headers: cabecalhos,
      data: { email: emailUnico("forca-bruta"), password: "senha errada 1234" },
    });

  const respostas = [];
  for (let tentativa = 1; tentativa <= 6; tentativa += 1) {
    respostas.push((await tentar()).status());
  }

  // Cinco tentativas por minuto; a sexta é recusada com 429.
  expect(respostas.slice(0, 5).every((status) => status === 401)).toBe(true);
  expect(respostas[5]).toBe(429);
});

function emailUnico(prefixo: string) {
  return `${prefixo}+${Date.now()}-${Math.round(Math.random() * 1e6)}@teste.brasa.example`;
}

async function cadastrar(page: Page, nome: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByLabel("E-mail de trabalho").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/onboarding");
}

async function entrar(page: Page, email: string, senha = SENHA) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("cliente: cadastro, onboarding, painel, perfil e saída", async ({ page }) => {
  const email = emailUnico("cliente");
  await cadastrar(page, "Carla Teste", email);

  await page.getByLabel("Nome da empresa").fill(`Metalúrgica E2E ${Date.now()}`);
  await expect(page.getByLabel("Endereço do formulário de captação")).toHaveValue(
    /^metalurgica-e2e-\d+$/,
  );
  await page.getByLabel("O que a sua empresa faz").fill("Fabricamos peças metálicas sob medida.");
  await page
    .getByLabel("Cliente ideal")
    .fill("Indústrias de médio porte que compram peças sob encomenda.");
  await page.getByRole("button", { name: "Criar empresa e ir para o painel" }).click();

  await page.waitForURL("**/painel");
  await expect(page.getByRole("heading", { level: 1, name: "Olá, Carla!" })).toBeVisible();

  // Menu do cliente: sem a área de administração.
  const menu = page.getByRole("navigation", { name: "Principal" }).first();
  await expect(menu.getByRole("link")).toHaveText(["Visão geral", "Leads", "Empresa"]);
  await expect(menu.getByRole("link", { name: "Visão geral" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // A administração não existe para o cliente (404).
  expect((await page.goto("/admin/empresas"))?.status()).toBe(404);

  // Alterar perfil pelo menu do avatar.
  await page.goto("/painel");
  await page.getByRole("button", { name: "Abrir o menu da conta" }).click();
  await page.getByRole("link", { name: "Alterar perfil" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Carla Teste Silva");
  await page.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByText("Nome atualizado.")).toBeVisible();

  // Sair encerra a sessão: o painel volta a exigir login.
  await page.getByRole("button", { name: "Abrir o menu da conta" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL("**/login");
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/login\?proximo=%2Fpainel/);

  // Senha errada: mensagem clara; senha certa: painel.
  await entrar(page, email, "senha errada 1234");
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await entrar(page, email);
  await page.waitForURL("**/painel");
});

test("conta bloqueada perde a sessão na hora e não consegue entrar", async ({ page }) => {
  const email = emailUnico("bloqueio");
  await cadastrar(page, "Bruno Bloqueado", email);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("UPDATE usuarios SET bloqueado_em = now() WHERE email = $1", [email]);
  } finally {
    await pool.end();
  }

  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);

  await entrar(page, email);
  await expect(page.getByText("Esta conta está bloqueada. Fale com o suporte.")).toBeVisible();
});
