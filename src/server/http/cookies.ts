import "server-only";

import { env } from "@/env";

/** Opções dos cookies de preferência do app (tema, empresa ativa). */
export const OPCOES_DE_COOKIE = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  httpOnly: true,
  secure: env.NODE_ENV === "production",
} as const;
