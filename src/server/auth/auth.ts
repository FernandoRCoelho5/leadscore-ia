import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { uuidv7 } from "@/lib/uuid";
import { enviarEmail } from "@/server/email/enviador";
import { registrarAuditoria, type NovoEventoDeAuditoria } from "@/server/repositories/auditoria";
import { obterUsuarioAtivo } from "@/server/repositories/usuarios";

/**
 * Autenticação com Better Auth (D-005), usada só para autenticar: cadastro,
 * login, sessão, troca e redefinição de senha. Multiempresa, convites e RBAC
 * são código nosso (src/server/auth/permissoes.ts).
 *
 * As tabelas e colunas têm nomes em português; o mapeamento abaixo diz à
 * biblioteca qual campo do nosso schema corresponde a cada campo dela.
 */

const UM_DIA = 60 * 60 * 24;

/** A auditoria nunca pode impedir um login: falhas vão só para o log. */
async function auditar(evento: NovoEventoDeAuditoria): Promise<void> {
  try {
    await registrarAuditoria(db, evento);
  } catch (erro) {
    logger.error("Falha ao registrar auditoria de autenticação", { acao: evento.acao, erro });
  }
}

export const auth = betterAuth({
  appName: "Brasa",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  advanced: {
    // IDs no mesmo padrão do resto do banco (UUID v7).
    database: { generateId: () => uuidv7() },
  },

  user: {
    modelName: "usuarios",
    fields: { name: "nome", emailVerified: "emailVerificado", image: "imagemUrl" },
  },
  session: {
    modelName: "sessoes",
    fields: {
      userId: "usuarioId",
      expiresAt: "expiraEm",
      ipAddress: "enderecoIp",
      userAgent: "agenteUsuario",
    },
    // Sessão de 7 dias, renovada a cada dia de uso.
    expiresIn: 7 * UM_DIA,
    updateAge: UM_DIA,
  },
  account: {
    modelName: "contas",
    // Tokens de login social (se um dia forem usados) ficam cifrados (AES-256-GCM).
    encryptOAuthTokens: true,
    fields: {
      userId: "usuarioId",
      accountId: "idNoProvedor",
      providerId: "provedor",
      password: "senha",
      accessToken: "tokenDeAcesso",
      refreshToken: "tokenDeAtualizacao",
      idToken: "tokenDeId",
      accessTokenExpiresAt: "tokenDeAcessoExpiraEm",
      refreshTokenExpiresAt: "tokenDeAtualizacaoExpiraEm",
      scope: "escopo",
    },
  },
  verification: {
    modelName: "verificacoes",
    fields: { identifier: "identificador", value: "valor", expiresAt: "expiraEm" },
    // Tokens de verificação (ex.: redefinição de senha) guardados só como hash.
    storeIdentifier: "hashed",
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Sem domínio próprio ainda, o e-mail não bloqueia o login (decisão da Etapa 4).
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await enviarEmail({
        para: user.email,
        assunto: "Redefina sua senha da Brasa",
        texto: `Olá, ${user.name}!\n\nRecebemos um pedido para redefinir a sua senha. Use o link abaixo (vale por 1 hora):\n\n${url}\n\nSe não foi você, ignore este e-mail: a sua senha continua a mesma.`,
      });
    },
  },

  // Limite de tentativas nas rotas sensíveis, guardado no banco (funciona com
  // várias instâncias serverless). Ativo em produção.
  rateLimit: {
    storage: "database",
    modelName: "limitesTaxaAuth",
    fields: { key: "chave", count: "contador", lastRequest: "ultimoPedido" },
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 600, max: 5 },
      "/request-password-reset": { window: 900, max: 3 },
      "/reset-password": { window: 900, max: 5 },
      "/change-password": { window: 600, max: 5 },
    },
  },

  // Rotas da biblioteca que não usamos: perfil e exclusão passam pelos nossos
  // serviços (validação, auditoria e exclusão lógica).
  disabledPaths: ["/update-user", "/delete-user", "/change-email"],

  databaseHooks: {
    user: {
      create: {
        after: async (usuario) => {
          await auditar({
            atorId: usuario.id,
            acao: "usuario.cadastrado",
            recursoTipo: "usuario",
            recursoId: usuario.id,
          });
        },
      },
    },
    session: {
      create: {
        // Usuário excluído (lógico) ou bloqueado não consegue abrir sessão.
        before: async (sessao) => {
          const usuario = await obterUsuarioAtivo(db, sessao.userId);
          if (!usuario || usuario.bloqueadoEm) {
            throw new APIError("FORBIDDEN", {
              message: "Esta conta está bloqueada. Fale com o suporte.",
            });
          }
        },
        after: async (sessao) => {
          await auditar({ atorId: sessao.userId, acao: "auth.login", recursoTipo: "sessao" });
        },
      },
      delete: {
        after: async (sessao) => {
          await auditar({
            atorId: sessao.userId,
            acao: "auth.sessao_encerrada",
            recursoTipo: "sessao",
          });
        },
      },
    },
  },

  // Permite que Server Actions (ex.: "Sair") gravem os cookies de sessão.
  plugins: [nextCookies()],
});
