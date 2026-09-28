import { afterEach, describe, expect, it, vi } from "vitest";

import { logger, ocultarSensiveis } from "@/lib/logger";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("ocultarSensiveis", () => {
  it("oculta segredos e dados pessoais em qualquer nível", () => {
    const resultado = ocultarSensiveis({
      usuario: { nome: "Ana", email: "ana@exemplo.com", senha: "123" },
      cabecalhos: { authorization: "Bearer abc", cookie: "sessao=xyz" },
      itens: [{ token: "t1" }, { telefone: "24999990000" }],
      ANTHROPIC_API_KEY: "sk-ant",
      DATABASE_URL: "postgresql://...",
    });

    expect(resultado).toEqual({
      usuario: { nome: "Ana", email: "[oculto]", senha: "[oculto]" },
      cabecalhos: { authorization: "[oculto]", cookie: "[oculto]" },
      itens: [{ token: "[oculto]" }, { telefone: "[oculto]" }],
      ANTHROPIC_API_KEY: "[oculto]",
      DATABASE_URL: "[oculto]",
    });
  });

  it("serializa erros com a causa", () => {
    const erro = new Error("falhou", { cause: new Error("raiz") });

    expect(ocultarSensiveis(erro)).toMatchObject({
      nome: "Error",
      mensagem: "falhou",
      causa: { nome: "Error", mensagem: "raiz" },
    });
  });

  it("converte bigint e corta estruturas muito profundas", () => {
    const profundo = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };

    expect(ocultarSensiveis(10n)).toBe("10");
    expect(JSON.stringify(ocultarSensiveis(profundo))).toContain('"[...]"');
  });
});

describe("logger", () => {
  it("escreve uma linha JSON no console correspondente ao nível", () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("falha ao salvar", { requestId: "abc", senha: "123" });

    const linha = JSON.parse(String(erro.mock.calls[0]?.[0]));
    expect(linha).toMatchObject({
      nivel: "error",
      mensagem: "falha ao salvar",
      requestId: "abc",
      senha: "[oculto]",
    });
    expect(typeof linha.horario).toBe("string");
  });

  it("não deixa o contexto sobrescrever nível e mensagem", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("real", { nivel: "falso", mensagem: "falsa" });

    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toMatchObject({
      nivel: "info",
      mensagem: "real",
    });
  });

  it("não escreve debug em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.debug("detalhe");

    expect(log).not.toHaveBeenCalled();
  });
});
