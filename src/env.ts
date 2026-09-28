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

/** Nome de host sem protocolo nem caminho, como a Vercel entrega (ex.: app-abc.vercel.app). */
const host = z
  .string()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i, "deve ser só o nome do host (ex.: app.vercel.app)");

const formato = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: (issue) =>
      issue.input === undefined ? "obrigatória" : "deve ser uma URL do Postgres (postgresql://...)",
  }),
  IA_MODO: z.enum(["mock", "real"], { error: 'deve ser "mock" ou "real"' }).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Autenticação: segredo que assina os cookies de sessão e endereço público do app.
  BETTER_AUTH_SECRET: z
    .string({ error: "obrigatória (gere com: openssl rand -base64 32)" })
    .min(32, "deve ter pelo menos 32 caracteres"),
  // Obrigatória, exceto nos deploys de preview da Vercel (a URL muda a cada deploy).
  BETTER_AUTH_URL: z
    .url({ error: "deve ser a URL pública do app (ex.: http://localhost:3000)" })
    .optional(),
  // E-mail (opcional): sem a chave, os e-mails são mostrados no terminal (só em desenvolvimento).
  RESEND_API_KEY: z.string().optional(),
  EMAIL_REMETENTE: z.string().default("Brasa <onboarding@resend.dev>"),
  // Fotos de perfil no Vercel Blob privado (D-024). Localmente, o token; na
  // Vercel, o SDK usa OIDC com o BLOB_STORE_ID. Sem nenhum dos dois, o envio de
  // foto fica indisponível (o resto do app funciona).
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  BLOB_STORE_ID: z.string().optional(),
  // Definidas pela Vercel (System Environment Variables). VERCEL_ENV separa as
  // fotos de cada ambiente no mesmo store; VERCEL_URL (endereço único do deploy)
  // e VERCEL_BRANCH_URL (endereço fixo da branch) servem aos deploys de preview.
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: host.optional(),
  VERCEL_BRANCH_URL: host.optional(),
});

const esquemaEnv = formato
  .refine((env) => env.IA_MODO !== "real" || env.ANTHROPIC_API_KEY !== undefined, {
    path: ["ANTHROPIC_API_KEY"],
    error: 'obrigatória quando IA_MODO="real"',
    // Roda mesmo se outros campos falharem, para listar todos os problemas de uma vez.
    when: () => true,
  })
  .refine(
    (env) =>
      env.BETTER_AUTH_URL !== undefined ||
      (env.VERCEL_ENV === "preview" && env.VERCEL_URL !== undefined),
    {
      path: ["BETTER_AUTH_URL"],
      error: "obrigatória (só pode faltar nos deploys de preview da Vercel, que usam a VERCEL_URL)",
      when: () => true,
    },
  )
  .transform((env) => {
    // As validações acima garantem um dos dois; o transform só roda com dados válidos.
    const urlDoApp = env.BETTER_AUTH_URL ?? `https://${env.VERCEL_URL}`;
    const origens = new Set([new URL(urlDoApp).origin]);
    if (env.VERCEL_ENV === "preview") {
      // O mesmo preview é aberto pelo endereço do deploy ou pelo da branch.
      for (const endereco of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) {
        if (endereco) {
          origens.add(`https://${endereco}`);
        }
      }
    }
    return {
      ...env,
      /** Endereço público do app: BETTER_AUTH_URL ou, no preview, o do próprio deploy. */
      URL_DO_APP: urlDoApp,
      /** Origens aceitas pelo Better Auth (proteção contra CSRF): só endereços exatos. */
      ORIGENS_CONFIAVEIS: [...origens],
    };
  });

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
