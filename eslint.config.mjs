import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: {
      // Regra do projeto: nada de `any`.
      "@typescript-eslint/no-explicit-any": "error",
      // `import type` deixa claro o que some no build e evita importar código à toa.
      "@typescript-eslint/consistent-type-imports": "error",
      // Logs passam pelo logger estruturado (src/lib/logger.ts), que oculta dados sensíveis.
      "no-console": "warn",
    },
  },
  {
    // O logger e os scripts de configuração escrevem no console; os testes o espionam.
    files: ["src/lib/logger.ts", "*.config.{ts,mts,mjs}", "tests/**"],
    rules: { "no-console": "off" },
  },
  // Desliga regras de estilo que conflitam com o Prettier (sempre por último).
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
