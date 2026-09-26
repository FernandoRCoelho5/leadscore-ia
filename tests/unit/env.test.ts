import { describe, expect, it } from "vitest";

import { validarEnv } from "@/env";

const URL_VALIDA = "postgresql://usuario:senha@exemplo.neon.tech/banco?sslmode=require";
const AUTH = {
  BETTER_AUTH_SECRET: "segredo-de-teste-com-pelo-menos-32-caracteres",
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("validarEnv", () => {
  it("aceita a configuração mínima e aplica os padrões", () => {
    const env = validarEnv({ ...AUTH, DATABASE_URL: URL_VALIDA });

    expect(env.DATABASE_URL).toBe(URL_VALIDA);
    expect(env.IA_MODO).toBe("mock");
    expect(env.NODE_ENV).toBe("development");
  });

  it("aceita os protocolos postgres:// e postgresql://", () => {
    expect(() => validarEnv({ ...AUTH, DATABASE_URL: "postgres://u:s@host/db" })).not.toThrow();
    expect(() => validarEnv({ ...AUTH, DATABASE_URL: "postgresql://u:s@host/db" })).not.toThrow();
  });

  it("trata valor vazio ou só com espaços como ausente", () => {
    expect(() => validarEnv({ ...AUTH, DATABASE_URL: "   " })).toThrow("DATABASE_URL: obrigatória");
  });

  it("rejeita URL que não é do Postgres", () => {
    expect(() => validarEnv({ ...AUTH, DATABASE_URL: "https://exemplo.com" })).toThrow(
      "DATABASE_URL: deve ser uma URL do Postgres",
    );
  });

  it("exige a chave da Anthropic quando IA_MODO=real", () => {
    expect(() => validarEnv({ ...AUTH, DATABASE_URL: URL_VALIDA, IA_MODO: "real" })).toThrow(
      'ANTHROPIC_API_KEY: obrigatória quando IA_MODO="real"',
    );
    expect(() =>
      validarEnv({ ...AUTH, DATABASE_URL: URL_VALIDA, IA_MODO: "real", ANTHROPIC_API_KEY: "chave" }),
    ).not.toThrow();
  });

  it("rejeita modo de IA desconhecido sem cobrar a chave por engano", () => {
    expect(() => validarEnv({ ...AUTH, DATABASE_URL: URL_VALIDA, IA_MODO: "turbo" })).toThrow(
      'IA_MODO: deve ser "mock" ou "real"',
    );
    expect(() => validarEnv({ ...AUTH, DATABASE_URL: URL_VALIDA, IA_MODO: "turbo" })).not.toThrow(
      "ANTHROPIC_API_KEY",
    );
  });

  it("exige um segredo de autenticação com pelo menos 32 caracteres", () => {
    expect(() =>
      validarEnv({ ...AUTH, DATABASE_URL: URL_VALIDA, BETTER_AUTH_SECRET: "curto" }),
    ).toThrow("BETTER_AUTH_SECRET: deve ter pelo menos 32 caracteres");
    expect(() =>
      validarEnv({ DATABASE_URL: URL_VALIDA, BETTER_AUTH_URL: AUTH.BETTER_AUTH_URL }),
    ).toThrow("BETTER_AUTH_SECRET: obrigatória");
  });

  it("lista todos os problemas de uma vez", () => {
    expect(() => validarEnv({ ...AUTH, IA_MODO: "real" })).toThrow(
      /DATABASE_URL: obrigatória[\s\S]*ANTHROPIC_API_KEY/,
    );
  });

  it("nunca inclui o valor das variáveis na mensagem de erro", () => {
    const segredo = "valor-super-secreto-123";
    try {
      validarEnv({ DATABASE_URL: segredo, IA_MODO: "real", ANTHROPIC_API_KEY: "" });
      expect.unreachable("deveria ter lançado erro");
    } catch (erro) {
      expect(String(erro)).not.toContain(segredo);
    }
  });
});
