import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErroLimiteExcedido, ErroNaoEncontrado, ErroValidacao } from "@/lib/erros";
import { executarAcao } from "@/server/http/acao";
import {
  MENSAGEM_ERRO_INTERNO,
  comTratamentoDeErros,
  obterRequestId,
  traduzirErro,
} from "@/server/http/responder";

const UUID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  // Os erros geram logs; aqui só interessa o comportamento.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("obterRequestId", () => {
  it("reaproveita um x-request-id válido", () => {
    expect(obterRequestId(new Headers({ "x-request-id": UUID }))).toBe(UUID);
  });

  it("gera um novo quando o recebido não é um UUID (evita injeção no log)", () => {
    const gerado = obterRequestId(new Headers({ "x-request-id": '"><script>' }));

    expect(gerado).not.toContain("script");
    expect(gerado).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("traduzirErro", () => {
  it("usa código, status e mensagem de um ErroApp", () => {
    const traduzido = traduzirErro(new ErroNaoEncontrado("Lead não encontrado."), UUID);

    expect(traduzido.status).toBe(404);
    expect(traduzido.corpo).toEqual({
      erro: { codigo: "NAO_ENCONTRADO", mensagem: "Lead não encontrado.", requestId: UUID },
    });
  });

  it("inclui os detalhes por campo nos erros de validação", () => {
    const erro = new ErroValidacao([{ campo: "email", mensagem: "E-mail inválido." }]);

    expect(traduzirErro(erro, UUID).corpo.erro.detalhes).toEqual([
      { campo: "email", mensagem: "E-mail inválido." },
    ]);
  });

  it("esconde a mensagem de erros inesperados e registra no log", () => {
    const traduzido = traduzirErro(new Error('relation "leads" does not exist'), UUID);

    expect(traduzido.status).toBe(500);
    expect(traduzido.corpo.erro).toEqual({
      codigo: "INTERNO",
      mensagem: MENSAGEM_ERRO_INTERNO,
      requestId: UUID,
    });
    expect(JSON.stringify(traduzido.corpo)).not.toContain("relation");
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("registra a pilha apenas nos erros 5xx", () => {
    traduzirErro(new ErroNaoEncontrado(), UUID);

    const linha = String(vi.mocked(console.log).mock.calls[0]?.[0]);
    expect(linha).not.toContain("pilha");
  });
});

describe("comTratamentoDeErros", () => {
  const requisicao = () => new NextRequest("http://localhost/api/teste");

  it("devolve a resposta do handler com o x-request-id", async () => {
    const rota = comTratamentoDeErros(async () => Response.json({ ok: true }));

    const resposta = await rota(requisicao(), undefined);

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("transforma exceções no formato único de erro", async () => {
    const rota = comTratamentoDeErros(async () => {
      throw new Error("falha interna");
    });

    const resposta = await rota(requisicao(), undefined);
    const corpo = await resposta.json();

    expect(resposta.status).toBe(500);
    expect(corpo.erro.codigo).toBe("INTERNO");
    expect(corpo.erro.requestId).toBe(resposta.headers.get("x-request-id"));
  });

  it("envia Retry-After quando o limite é excedido", async () => {
    const rota = comTratamentoDeErros(async () => {
      throw new ErroLimiteExcedido(undefined, 60);
    });

    const resposta = await rota(requisicao(), undefined);

    expect(resposta.status).toBe(429);
    expect(resposta.headers.get("Retry-After")).toBe("60");
  });
});

describe("executarAcao", () => {
  it("devolve ok com os dados em caso de sucesso", async () => {
    expect(await executarAcao(async () => 42)).toEqual({ ok: true, dados: 42 });
  });

  it("devolve ok: false com o erro de domínio", async () => {
    const resultado = await executarAcao(async () => {
      throw new ErroNaoEncontrado();
    });

    expect(resultado).toMatchObject({ ok: false, erro: { codigo: "NAO_ENCONTRADO" } });
  });

  it("esconde erros inesperados", async () => {
    const resultado = await executarAcao(async () => {
      throw new Error("detalhe interno");
    });

    expect(resultado).toMatchObject({
      ok: false,
      erro: { codigo: "INTERNO", mensagem: MENSAGEM_ERRO_INTERNO },
    });
  });

  it("deixa o redirect() do Next.js continuar funcionando", async () => {
    await expect(executarAcao(async () => redirect("/login"))).rejects.toThrow("NEXT_REDIRECT");
  });
});
