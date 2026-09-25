import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Regra do projeto: as variáveis ficam no .env.local, carregado aqui com dotenv.
config({ path: ".env.local", quiet: true });

const urlDoBanco = process.env.DATABASE_URL;
if (!urlDoBanco) {
  throw new Error("DATABASE_URL ausente: configure o .env.local (modelo em .env.example).");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  // Migrations versionadas no Git; o SQL é revisado antes de aplicar (D-010).
  out: "./drizzle",
  dbCredentials: { url: urlDoBanco },
  // Pede confirmação em operações ambíguas e mostra o SQL executado.
  strict: true,
  verbose: true,
});
