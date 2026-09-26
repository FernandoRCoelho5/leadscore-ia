import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth/auth";

/** Rotas do Better Auth (cadastro, login, logout, senha), com o rate limit da biblioteca. */
export const { GET, POST } = toNextJsHandler(auth);
