import { z } from "zod";

/**
 * Variáveis de ambiente validadas com Zod.
 *
 * A validação roda cedo: ao carregar o `next.config.ts` (`next dev`,
 * `next build`, `next start`) e no `instrumentation.ts` (início do servidor).
 * Se faltar algo, a aplicação para com uma mensagem que cita apenas o NOME da
 * variável, nunca o valor.
 *
 * Uso: `import { env } from "@/env"` somente em código de servidor.
 * Variáveis novas entram aqui na etapa que passar a usá-las.
 */

const formato = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: (issue) =>
      issue.input === undefined
        ? "obrigatória"
        : "deve ser uma URL do Postgres (postgresql://...)",
  }),
  IA_MODO: z.enum(["mock", "real"], { error: 'deve ser "mock" ou "real"' }).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
});

const esquemaEnv = formato.refine(
  (env) => env.IA_MODO === "mock" || env.ANTHROPIC_API_KEY !== undefined,
  { path: ["ANTHROPIC_API_KEY"], error: 'obrigatória quando IA_MODO="real"' },
);

export type Env = z.infer<typeof esquemaEnv>;

type FonteDeVariaveis = Readonly<Record<string, string | undefined>>;

/** Lê só as variáveis conhecidas; valor vazio ou só com espaços conta como ausente. */
function lerVariaveis(fonte: FonteDeVariaveis): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.keys(formato.shape).map((nome) => {
      const valor = fonte[nome]?.trim();
      return [nome, valor === "" ? undefined : valor];
    }),
  );
}

/** Valida as variáveis e lança um erro legível (sem valores) se algo estiver errado. */
export function validarEnv(fonte: FonteDeVariaveis): Env {
  const resultado = esquemaEnv.safeParse(lerVariaveis(fonte));
  if (resultado.success) {
    return resultado.data;
  }

  const problemas = resultado.error.issues.map(
    (issue) => `  - ${issue.path.map(String).join(".")}: ${issue.message}`,
  );
  throw new Error(
    [
      "Variáveis de ambiente inválidas ou ausentes:",
      ...problemas,
      "Confira o arquivo .env.local (o modelo está em .env.example).",
    ].join("\n"),
  );
}

if (typeof window !== "undefined") {
  throw new Error("src/env.ts só pode ser importado em código de servidor.");
}

export const env: Env = validarEnv(process.env);
