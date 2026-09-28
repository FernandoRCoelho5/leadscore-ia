import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErroLimiteExcedido } from "@/lib/erros";
import { esquemaLeadPublico } from "@/lib/validacao/lead";
import { criarCarimbo, lerCarimbo } from "@/server/seguranca/carimbo";
import { hashDoIp, obterIp } from "@/server/seguranca/ip";

// A rota é testada sem banco: o serviço (testado na integração) é substituído.
const captarLead = vi.hoisted(() => vi.fn());
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/services/captacao", () => ({ captarLead }));

const { POST } = await import("@/app/api/publico/[slug]/leads/route");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  captarLead.mockResolvedValue({ situacao: "recebido", leadId: "id" });
});

afterEach(() => {
  vi.restoreAllMocks();
  captarLead.mockReset();
});

const VALIDO = {
  nome: "Maria Souza",
  email: " Maria@Empresa.Example ",
  telefone: "+55 (24) 99999-0001",
  empresaNome: "",
  segmento: "Saúde",
  mensagem: "Quero um orçamento para o site da clínica.",
  consentimento: "sim",
};

describe("esquemaLeadPublico", () => {
  it("aceita um envio completo e normaliza os campos", () => {
    const dados = esquemaLeadPublico.parse(VALIDO);

    expect(dados).toEqual({
      ...VALIDO,
      email: "maria@empresa.example",
      empresaNome: null,
    });
  });

  it.each([
    ["telefone com letras", { telefone: "24 9999-abcd" }, "telefone"],
    ["telefone sem DDD", { telefone: "9999-0001" }, "telefone"],
    ["segmento fora da lista", { segmento: "Mineração espacial" }, "segmento"],
    ["mensagem curta demais", { mensagem: "oi" }, "mensagem"],
    ["mensagem longa demais", { mensagem: "a".repeat(2001) }, "mensagem"],
    ["e-mail inválido", { email: "maria@" }, "email"],
    ["consentimento com outro valor", { consentimento: "on" }, "consentimento"],
  ])("recusa %s", (_caso, alteracao, campo) => {
    const resultado = esquemaLeadPublico.safeParse({ ...VALIDO, ...alteracao });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((issue) => issue.path[0])).toEqual([campo]);
  });
});

describe("obterIp e hashDoIp", () => {
  it("usa o primeiro endereço do x-forwarded-for", () => {
    const cabecalhos = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });

    expect(obterIp(cabecalhos)).toBe("203.0.113.7");
  });

  it("recorre ao x-real-ip e devolve null sem cabeçalho ou com valor absurdo", () => {
    expect(obterIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(obterIp(new Headers())).toBeNull();
    expect(obterIp(new Headers({ "x-forwarded-for": "x".repeat(100) }))).toBeNull();
  });

  it("o hash é estável, tem 64 caracteres e não contém o IP", () => {
    const hash = hashDoIp("203.0.113.7");

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoIp("203.0.113.7")).toBe(hash);
    expect(hashDoIp("203.0.113.8")).not.toBe(hash);
  });
});

describe("carimbo do formulário", () => {
  const empresaId = "0191f5a0-0000-7000-8000-000000000001";
  const agora = new Date("2026-09-26T12:00:00.000Z");

  it("devolve a idade de um carimbo válido", () => {
    const carimbo = criarCarimbo(empresaId, new Date(agora.getTime() - 8_000));

    expect(lerCarimbo(carimbo, empresaId, agora)).toEqual({ valido: true, idadeMs: 8_000 });
  });

  it.each([
    ["não texto", 123],
    ["sem assinatura", "1727352000000"],
    ["partes a mais", "1.2.3"],
    ["instante não numérico", "abc.def"],
    ["longo demais", "1".repeat(101)],
  ])("recusa carimbo %s", (_caso, carimbo) => {
    expect(lerCarimbo(carimbo, empresaId, agora)).toEqual({ valido: false });
  });

  it("recusa carimbo do futuro (relógio adulterado)", () => {
    const carimbo = criarCarimbo(empresaId, new Date(agora.getTime() + 60_000));

    expect(lerCarimbo(carimbo, empresaId, agora)).toEqual({ valido: false });
  });
});

describe("POST /api/publico/[slug]/leads", () => {
  const URL_DA_ROTA = "http://localhost:3000/api/publico/agencia/leads";

  function enviar(corpo: string, cabecalhos: Record<string, string> = {}) {
    const request = new NextRequest(URL_DA_ROTA, {
      method: "POST",
      body: corpo,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": "203.0.113.9",
        ...cabecalhos,
      },
    });
    return POST(request, { params: Promise.resolve({ slug: "agencia" }) });
  }

  it("aceita o envio e responde 201 sem devolver o id do lead", async () => {
    const resposta = await enviar(JSON.stringify(VALIDO));

    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toEqual({ recebido: true });
    expect(captarLead).toHaveBeenCalledWith(
      {},
      { slug: "agencia", corpo: VALIDO, ip: "203.0.113.9" },
      expect.objectContaining({ agendarAnalise: expect.any(Function) }),
    );
  });

  it("envio descartado como robô recebe a mesma resposta de sucesso", async () => {
    captarLead.mockResolvedValue({ situacao: "descartado", motivo: "armadilha" });

    const resposta = await enviar(JSON.stringify(VALIDO));

    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toEqual({ recebido: true });
  });

  it("recusa outra origem (403)", async () => {
    const resposta = await enviar(JSON.stringify(VALIDO), { origin: "https://golpe.example" });

    expect(resposta.status).toBe(403);
    expect(captarLead).not.toHaveBeenCalled();
  });

  it("aceita chamada sem cabeçalho de origem (fora do navegador)", async () => {
    const request = new NextRequest(URL_DA_ROTA, {
      method: "POST",
      body: JSON.stringify(VALIDO),
      headers: { "content-type": "application/json" },
    });

    const resposta = await POST(request, { params: Promise.resolve({ slug: "agencia" }) });

    expect(resposta.status).toBe(201);
  });

  it.each([
    ["sem JSON (formulário HTML de outro site)", "nome=x", { "content-type": "text/plain" }],
    ["JSON inválido", "{nome:", {}],
    ["corpo grande demais", JSON.stringify({ mensagem: "a".repeat(20_000) }), {}],
  ])("recusa %s (400)", async (_caso, corpo, cabecalhos) => {
    const resposta = await enviar(corpo, cabecalhos);

    expect(resposta.status).toBe(400);
    expect(captarLead).not.toHaveBeenCalled();
  });

  it("limite excedido: 429 com Retry-After", async () => {
    captarLead.mockRejectedValue(new ErroLimiteExcedido("Muitas mensagens.", 90));

    const resposta = await enviar(JSON.stringify(VALIDO));

    expect(resposta.status).toBe(429);
    expect(resposta.headers.get("Retry-After")).toBe("90");
  });
});
