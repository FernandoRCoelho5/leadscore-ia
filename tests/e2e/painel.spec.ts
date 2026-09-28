import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { cadastrar, clienteComEmpresa, consultar, emailUnico, novaPagina } from "./apoio";

/**
 * Painel (Etapa 7) com banco real: lista de leads, detalhe, exportação e a
 * administração da equipe Brasa. Roda só com E2E_COM_BANCO=1 (no CI, na
 * branch "e2e" do Neon). Os testes só inserem e alteram os próprios dados,
 * com e-mails do domínio reservado .example; nada é apagado.
 */

test.skip(!process.env.E2E_COM_BANCO, "Defina E2E_COM_BANCO=1 para rodar os testes com banco.");

async function inserirLead(
  empresaId: string,
  nome: string,
  classificacao: "quente" | "morno" | "frio",
  score: number,
) {
  await consultar(
    `INSERT INTO leads (id, empresa_id, nome, email, empresa_nome, mensagem, consentimento_lgpd,
                        consentimento_em, status_analise, score_atual, classificacao_atual)
     VALUES (gen_random_uuid(), $1, $2, $3, 'Metalúrgica Teste', 'Queremos um site novo.', true,
             now(), 'concluida', $4, $5)`,
    [empresaId, nome, emailUnico("lead"), score, classificacao],
  );
}

test("cliente: lista com filtros, detalhe, andamento e exportação em CSV", async ({ browser }) => {
  const page = await novaPagina(browser);
  const { empresaId } = await clienteComEmpresa(page);
  await inserirLead(empresaId, "Quente E2E", "quente", 88);
  await inserirLead(empresaId, "Morno E2E", "morno", 55);
  await inserirLead(empresaId, "Frio E2E", "frio", 18);

  await page.goto("/leads");
  const tabela = page.getByRole("table", { name: "Leads" });
  await expect(tabela.getByRole("row")).toHaveCount(4);
  await expect(page.getByText("Mostrando 1–3 de 3 leads")).toBeVisible();

  // Filtro pela classificação: fica na URL.
  const filtros = page.getByRole("search", { name: "Filtrar leads" });
  await filtros.getByLabel("Classificação").selectOption({ label: "Quente" });
  await filtros.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/classificacao=quente/);
  await expect(tabela.getByRole("row")).toHaveCount(2);

  // Detalhe e andamento.
  await tabela.getByRole("link", { name: "Quente E2E" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quente E2E" })).toBeVisible();
  await page.getByLabel("Etapa atual").selectOption({ label: "Em contato" });
  await page.getByRole("button", { name: "Salvar andamento" }).click();
  await expect(page.getByText("Andamento atualizado.")).toBeVisible();

  await page.goto("/leads?status=em_contato");
  await expect(tabela.getByRole("row")).toHaveCount(2);
  await expect(tabela.getByRole("link", { name: "Quente E2E" })).toBeVisible();

  // Exportação com os filtros da tela, pronta para o Excel brasileiro.
  const baixando = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV" }).click();
  const arquivo = await baixando;
  expect(arquivo.suggestedFilename()).toMatch(/^leads-\d{4}-\d{2}-\d{2}\.csv$/);
  const conteudo = await readFile(await arquivo.path(), "utf8");
  expect(conteudo.startsWith("﻿Nome;E-mail;")).toBe(true);
  expect(conteudo).toContain("Quente E2E");
  expect(conteudo).not.toContain("Morno E2E");
});

test("equipe: abre a empresa do cliente (auditado), ajusta o limite, bloqueia e desbloqueia", async ({
  browser,
}) => {
  // Fluxo com várias pessoas e muitas idas ao servidor: no CI, longe do banco, passa de 30 s.
  test.slow();
  const cliente = await novaPagina(browser);
  const { nome } = await clienteComEmpresa(cliente);

  const admin = await novaPagina(browser);
  const emailDoAdmin = emailUnico("admin");
  await cadastrar(admin, "Ana Admin", emailDoAdmin);
  await consultar("UPDATE usuarios SET papel_plataforma = 'admin' WHERE email = $1", [
    emailDoAdmin,
  ]);

  try {
    // O papel é relido do banco a cada requisição: já entra como admin.
    await admin.goto("/admin/empresas");
    const filtros = admin.getByRole("search", { name: "Filtrar empresas" });
    await filtros.getByLabel("Buscar").fill(nome);
    await filtros.getByRole("button", { name: "Filtrar" }).click();
    const tabela = admin.getByRole("table", { name: "Empresas clientes" });
    await expect(tabela.getByRole("row")).toHaveCount(2);

    // Abrir a empresa: o admin passa a ver o painel dela, com a saída sempre visível.
    await tabela.getByRole("button", { name: `Abrir ${nome}` }).click();
    await admin.waitForURL("**/painel");
    await expect(admin.getByText(`Acessando como equipe Brasa: ${nome}`)).toBeAttached();
    await admin.goto("/leads");
    await expect(admin.getByRole("heading", { name: "Nenhum lead ainda" })).toBeVisible();
    await admin.getByRole("button", { name: "Sair da empresa" }).click();
    await admin.waitForURL("**/admin/empresas");

    // Limite e bloqueio, no diálogo "Gerenciar".
    await admin.goto(`/admin/empresas?busca=${encodeURIComponent(nome)}`);
    await tabela.getByRole("button", { name: `Gerenciar ${nome}` }).click();
    const dialogo = admin.getByRole("dialog", { name: "Gerenciar empresa" });
    await dialogo.getByLabel("Limite de análises da IA por mês").fill("250");
    await dialogo.getByRole("button", { name: "Salvar limite" }).click();
    await expect(dialogo.getByText("Limite atualizado.")).toBeVisible();

    await dialogo.getByRole("button", { name: "Bloquear empresa…" }).click();
    await expect(
      dialogo.getByText("Os usuários da empresa perdem o acesso ao painel."),
    ).toBeVisible();
    await dialogo.getByRole("button", { name: "Bloquear empresa", exact: true }).click();
    await expect(dialogo.getByText("Empresa bloqueada.")).toBeVisible();
    await expect(dialogo.getByRole("heading", { name: "Situação: bloqueada" })).toBeVisible();

    // O cliente perde o painel na hora e não consegue criar outra empresa.
    await cliente.goto("/painel");
    await cliente.waitForURL("**/empresa-bloqueada");
    await expect(
      cliente.getByRole("heading", { name: "O acesso da sua empresa está suspenso" }),
    ).toBeVisible();
    await cliente.goto("/onboarding");
    await cliente.waitForURL("**/empresa-bloqueada");

    await dialogo.getByRole("button", { name: "Desbloquear empresa" }).click();
    await expect(dialogo.getByText("Empresa desbloqueada.")).toBeVisible();
    await cliente.goto("/painel");
    await expect(cliente.getByRole("heading", { level: 1, name: "Olá, Paula!" })).toBeVisible();

    // Tudo ficou na auditoria.
    await admin.goto("/admin/auditoria?acao=empresa.bloqueada");
    const eventos = admin.getByRole("table", { name: "Eventos da auditoria" });
    await expect(eventos.getByRole("row").filter({ hasText: nome }).first()).toContainText(
      "Bloqueou a empresa",
    );
  } finally {
    // A conta de admin de teste não fica utilizável depois do teste.
    await consultar("UPDATE usuarios SET bloqueado_em = now() WHERE email = $1", [emailDoAdmin]);
  }
});

test("um cliente não abre o lead de outra empresa nem pela URL (404, sem revelar que existe)", async ({
  browser,
}) => {
  // Fluxo com várias pessoas e muitas idas ao servidor: no CI, longe do banco, passa de 30 s.
  test.slow();
  const outra = await novaPagina(browser);
  const { empresaId: empresaDaOutra } = await clienteComEmpresa(outra);
  await inserirLead(empresaDaOutra, "Lead Alheio", "quente", 90);
  const [lead] = await consultar<{ id: string }>(
    "SELECT id FROM leads WHERE empresa_id = $1 AND nome = 'Lead Alheio'",
    [empresaDaOutra],
  );

  const intrusa = await novaPagina(browser);
  await clienteComEmpresa(intrusa, "Ivo Intruso");

  const resposta = await intrusa.goto(`/leads/${lead?.id ?? ""}`);
  expect(resposta?.status()).toBe(404);
  await expect(intrusa.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await expect(intrusa.getByText("Lead Alheio")).toHaveCount(0);

  // A exportação usa só a empresa da sessão: o lead alheio não aparece no arquivo.
  const csv = await intrusa.request.get("/api/leads/exportar");
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).not.toContain("Lead Alheio");
});
