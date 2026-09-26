"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Cliente de autenticação usado pelos formulários (login, cadastro, senha).
 * Chama as rotas /api/auth/*, que têm limite de tentativas; por isso o login
 * não passa por Server Action (chamadas internas não contam no limite).
 */
export const authCliente = createAuthClient();
