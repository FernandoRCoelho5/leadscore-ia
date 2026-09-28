import { ambienteQueMigra } from "./banco/ambienteDoDeploy";
import { aplicarMigrations } from "./banco/aplicarMigrations";

/**
 * Aplica as migrations no banco do ambiente durante o build da Vercel, antes
 * do `next build` (D-031). O código novo só entra no ar com o banco já
 * atualizado: se a migration falhar, a transação é desfeita, o build para e o
 * deploy anterior continua valendo.
 *
 * Usa a mesma preparação do banco E2E (trava, linha de base das cópias
 * "schema only" e transação; D-025) e o DATABASE_URL que a Vercel já tem para
 * aquele ambiente. As migrations do projeto só acrescentam (sem DROP), então o
 * código anterior segue funcionando com o banco novo, inclusive num rollback.
 *
 * Fora de um build da Vercel não faz nada. Uso (vercel.json):
 *   npm run db:implantar && npm run build
 */
async function principal(): Promise<void> {
  const ambiente = ambienteQueMigra(process.env);
  if (!ambiente) {
    console.log("Fora de um build da Vercel (production ou preview): nenhuma migration aplicada.");
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(`DATABASE_URL ausente no ambiente ${ambiente} da Vercel.`);
  }

  const resumo = await aplicarMigrations(url);
  console.log(
    `Banco de ${ambiente}: ${resumo.registradas} migration(s) já existente(s) registrada(s), ` +
      `${resumo.aplicadas} aplicada(s), ${resumo.total} no total.`,
  );
}

principal().catch((erro: unknown) => {
  // Só a mensagem: a URL de conexão (com senha) nunca vai para o log do build.
  console.error("Falha ao aplicar as migrations:", erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
