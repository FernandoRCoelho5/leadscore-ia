import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const caminho = (relativo: string) => fileURLToPath(new URL(relativo, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": caminho("./src"),
      // "server-only" lança erro fora do servidor do Next.js; nos testes vira um módulo vazio.
      "server-only": caminho("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integracao/**/*.test.ts"],
    // Os testes de integração sobem um Postgres em memória (PGlite) por arquivo.
    hookTimeout: 30_000,
    // Valores fictícios para que src/env.ts possa ser importado nos testes.
    env: {
      DATABASE_URL: "postgresql://teste:teste@localhost:5432/teste",
      IA_MODO: "mock",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // src/db/index.ts conecta no Neon real (exercitado pelo seed, não pelos testes).
      exclude: ["src/**/*.d.ts", "src/app/**", "src/instrumentation.ts", "src/db/index.ts"],
      reporter: ["text", "html"],
      // Meta do projeto (docs/decisoes.md, D-013): o CI falha abaixo disso.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
