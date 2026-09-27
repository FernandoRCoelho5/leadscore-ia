import { Pool } from "@neondatabase/serverless";
import type { Browser, Page } from "@playwright/test";
import { config } from "dotenv";

/**
 * Auxiliares dos testes E2E com banco: contas e empresas únicas por teste,
 * sempre com e-mails do domínio reservado .example. Só inserem e alteram os
 * próprios dados; nada é apagado.
 */

config({ path: ".env.local", quiet: true });

export const SENHA = "uma senha longa de teste";

export function unico(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export function emailUnico(prefixo: string) {
  return `${unico(prefixo)}@teste.brasa.example`;
}

/** IP fictício (faixa de documentação 203.0.113.0/24) para o limitador de tentativas. */
export function ipFicticio() {
  return `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
}

export async function consultar<Linha extends Record<string, unknown>>(
  sql: string,
  parametros: unknown[],
): Promise<Linha[]> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<Linha>(sql, parametros);
    return rows;
  } finally {
    await pool.end();
  }
}

export async function novaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": ipFicticio() },
  });
  return contexto.newPage();
}

export async function cadastrar(page: Page, nome: string, email: string) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByLabel("E-mail de trabalho").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/onboarding");
}

/** Cadastra um cliente com empresa e devolve o id e o nome da empresa e o e-mail da pessoa. */
export async function clienteComEmpresa(
  page: Page,
  pessoa = "Paula Painel",
): Promise<{ empresaId: string; nome: string; email: string }> {
  const email = emailUnico("painel");
  const nome = `Agência Painel ${unico("e2e").slice(-10)}`;
  await cadastrar(page, pessoa, email);
  await page.getByLabel("Nome da empresa").fill(nome);
  await page.getByLabel("O que a sua empresa faz").fill("Criamos sites e lojas virtuais B2B.");
  await page.getByLabel("Cliente ideal").fill("Indústrias de médio porte do Sul Fluminense.");
  await page.getByRole("button", { name: "Criar empresa e ir para o painel" }).click();
  await page.waitForURL("**/painel");

  const [linha] = await consultar<{ id: string }>(
    `SELECT e.id FROM empresas e
       JOIN membros_empresa m ON m.empresa_id = e.id
       JOIN usuarios u ON u.id = m.usuario_id
      WHERE u.email = $1`,
    [email],
  );
  if (!linha) {
    throw new Error("empresa do cliente não encontrada");
  }
  return { empresaId: linha.id, nome, email };
}
