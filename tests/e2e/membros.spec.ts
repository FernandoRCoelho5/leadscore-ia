import { expect, test } from "@playwright/test";

import { cadastrar, clienteComEmpresa, consultar, emailUnico, novaPagina, SENHA } from "./apoio";

/**
 * Membros e convites (D-030) e troca de perfil de acesso, com banco real.
 * Roda só com E2E_COM_BANCO=1 (no CI, na branch "e2e" do Neon).
 */

test.skip(!process.env.E2E_COM_BANCO, "Defina E2E_COM_BANCO=1 para rodar os testes com banco.");

test("convite por link: a pessoa cria a conta pelo link, entra na empresa e pode ser removida", async ({
  browser,
}) => {
  const dona = await novaPagina(browser);
  const { nome: empresa } = await clienteComEmpresa(dona);

  // A dona gera o convite; sem serviço de e-mail configurado, o link aparece para copiar.
  const emailDaConvidada = emailUnico("convidada");
  await dona
    .getByRole("navigation", { name: "Principal" })
    .first()
    .getByRole("link", { name: "Membros" })
    .click();
  await dona.getByLabel("E-mail da pessoa").fill(emailDaConvidada);
  await dona.getByRole("button", { name: "Gerar convite" }).click();
  await expect(dona.getByText(`Convite criado para ${emailDaConvidada}.`)).toBeVisible();
  const link = await dona.getByLabel("Link do convite").inputValue();
  await expect(dona.getByRole("heading", { name: "Convites pendentes" })).toBeVisible();

  // A convidada abre o link sem conta, cria a conta e volta para aceitar.
  const convidada = await novaPagina(browser);
  await convidada.goto(new URL(link).pathname);
  await expect(convidada.getByRole("heading", { name: `Convite para a ${empresa}` })).toBeVisible();
  await convidada.getByRole("link", { name: "Criar conta" }).click();
  await convidada.getByLabel("Seu nome").fill("Vera Convidada");
  await convidada.getByLabel("E-mail de trabalho").fill(emailDaConvidada);
  await convidada.getByLabel("Senha", { exact: true }).fill(SENHA);
  await convidada.getByRole("button", { name: "Criar conta" }).click();
  await convidada.getByRole("button", { name: `Aceitar e entrar na ${empresa}` }).click();
  await convidada.waitForURL("**/painel");
  await expect(convidada.getByRole("banner").getByText(empresa, { exact: true })).toBeVisible();

  // O link não vale duas vezes.
  await convidada.goto(new URL(link).pathname);
  await expect(convidada.getByRole("heading", { name: "Este convite já foi usado" })).toBeVisible();

  // A dona vê a nova pessoa e a remove (com confirmação): o acesso acaba na hora.
  await dona.reload();
  const vera = dona
    .getByRole("region", { name: "Pessoas" })
    .getByRole("listitem")
    .filter({ hasText: "Vera Convidada" });
  await expect(vera).toHaveCount(1);
  await expect(dona.getByRole("heading", { name: "Convites pendentes" })).toHaveCount(0);
  await dona.getByRole("button", { name: "Remover Vera Convidada" }).click();
  await dona.getByRole("dialog").getByRole("button", { name: "Remover" }).click();
  await expect(vera).toHaveCount(0);

  await convidada.goto("/painel");
  await convidada.waitForURL("**/onboarding");
});

test("o admin muda o perfil de um cliente para suporte, e ele passa a ver a administração", async ({
  browser,
}) => {
  const pessoa = await novaPagina(browser);
  const emailDaPessoa = emailUnico("promovida");
  await cadastrar(pessoa, "Rita Promovida", emailDaPessoa);

  const admin = await novaPagina(browser);
  const emailDoAdmin = emailUnico("admin");
  await cadastrar(admin, "Ana Admin", emailDoAdmin);
  await consultar("UPDATE usuarios SET papel_plataforma = 'admin' WHERE email = $1", [
    emailDoAdmin,
  ]);

  try {
    await admin.goto(`/admin/usuarios?busca=${encodeURIComponent(emailDaPessoa)}`);
    const tabela = admin.getByRole("table", { name: "Usuários da plataforma" });
    await tabela.getByRole("button", { name: "Gerenciar Rita Promovida" }).click();
    const dialogo = admin.getByRole("dialog", { name: "Gerenciar usuário" });
    await dialogo.getByRole("radio", { name: /^Suporte/ }).check();
    await dialogo.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(dialogo.getByText("Perfil alterado para Suporte.")).toBeVisible();
    await expect(tabela.getByRole("row").filter({ hasText: "Rita Promovida" })).toContainText(
      "Suporte",
    );

    // Vale na próxima página que a pessoa abrir: sai do onboarding e vê a administração.
    await pessoa.goto("/painel");
    await expect(pessoa.getByText("Administração da plataforma Brasa")).toBeVisible();
    await expect(
      pessoa
        .getByRole("navigation", { name: "Principal" })
        .first()
        .getByRole("link", { name: "Auditoria" }),
    ).toBeVisible();
  } finally {
    // Contas da equipe criadas no teste não ficam utilizáveis.
    await consultar("UPDATE usuarios SET bloqueado_em = now() WHERE email = ANY($1)", [
      [emailDoAdmin, emailDaPessoa],
    ]);
  }
});
