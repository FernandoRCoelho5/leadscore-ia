import { defineConfig, devices } from "@playwright/test";

// Porta própria para não conflitar com o `npm run dev` (3000).
const PORTA = 3100;
const URL_BASE = `http://localhost:${PORTA}`;
const NO_CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: NO_CI,
  retries: NO_CI ? 2 : 0,
  reporter: NO_CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: URL_BASE,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Testa o build de produção, onde a CSP é a mais restritiva.
    command: `npm run build && npx next start -p ${PORTA}`,
    url: `${URL_BASE}/api/saude`,
    reuseExistingServer: !NO_CI,
    timeout: 240_000,
  },
});
