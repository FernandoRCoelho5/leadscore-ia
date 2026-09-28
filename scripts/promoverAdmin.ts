import "./carregarEnv";

import { db, encerrarBanco } from "../src/db";
import { env } from "../src/env";
import { promoverPrimeiroAdmin } from "../src/server/services/administracao";

/**
 * Cria o primeiro admin da plataforma (D-031): a pessoa se cadastra pelo app
 * e este comando promove a conta dela. Só funciona enquanto a plataforma não
 * tem admin ativo; depois, novos admins são promovidos na tela Usuários.
 *
 * Usa o DATABASE_URL do ambiente (que vale mais que o do .env.local). Para a
 * produção, no PowerShell:
 *   $env:DATABASE_URL="<URL da branch production>"; npm run admin:promover -- pessoa@empresa.com.br
 * O passo a passo está em docs/implantacao.md.
 */
async function principal(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    throw new Error("Informe o e-mail da conta: npm run admin:promover -- pessoa@empresa.com.br");
  }
  // Só o nome do host, para conferir o banco; a senha nunca aparece.
  console.log(`Banco: ${new URL(env.DATABASE_URL).host}`);
  const { nome } = await promoverPrimeiroAdmin(db, email);
  console.log(`${nome} agora é admin da plataforma. Recarregue o app para ver a administração.`);
}

principal()
  .catch((erro: unknown) => {
    console.error("Não foi possível promover:", erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => encerrarBanco());
