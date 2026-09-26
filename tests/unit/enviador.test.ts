import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Env } from "@/env";
import { enviarEmail, type Email } from "@/server/email/enviador";

/** Envio de e-mail (D-011): Resend com a chave; terminal em desenvolvimento; erro em produção. */

const simulado = vi.hoisted(() => ({
  env: {} as Partial<Env>,
}));

vi.mock("@/env", () => ({ env: simulado.env }));

const EMAIL: Email = {
  para: "pessoa@teste.example",
  assunto: "Redefina sua senha da Brasa",
  texto: "Link: http://localhost:3000/api/auth/reset-password/token-secreto",
};

function configurar(env: Partial<Env>) {
  for (const chave of Object.keys(simulado.env)) {
    delete simulado.env[chave as keyof Env];
  }
  Object.assign(simulado.env, { EMAIL_REMETENTE: "Brasa <nao-responda@brasa.example>", ...env });
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("enviarEmail", () => {
  it("em desenvolvimento, sem chave, mostra o e-mail no terminal", async () => {
    configurar({ NODE_ENV: "development" });

    await enviarEmail(EMAIL);

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining(EMAIL.texto));
  });

  it("em produção, sem chave, recusa em vez de mostrar o link no log", async () => {
    configurar({ NODE_ENV: "production" });

    await expect(enviarEmail(EMAIL)).rejects.toThrow("RESEND_API_KEY ausente");
    expect(console.info).not.toHaveBeenCalled();
  });

  it("com a chave, envia pela API do Resend", async () => {
    configurar({ NODE_ENV: "production", RESEND_API_KEY: "re_chave_de_teste" });
    const fetchSimulado = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSimulado);

    await enviarEmail(EMAIL);

    expect(fetchSimulado).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_chave_de_teste" }),
      }),
    );
    const corpo: unknown = JSON.parse(String(fetchSimulado.mock.calls[0]?.[1]?.body));
    expect(corpo).toEqual({
      from: "Brasa <nao-responda@brasa.example>",
      to: [EMAIL.para],
      subject: EMAIL.assunto,
      text: EMAIL.texto,
    });
  });

  it("falha do Resend vira erro, sem registrar o conteúdo do e-mail no log", async () => {
    configurar({ NODE_ENV: "production", RESEND_API_KEY: "re_chave_de_teste" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("erro", { status: 500 })),
    );

    await expect(enviarEmail(EMAIL)).rejects.toThrow("Não foi possível enviar o e-mail.");
    expect(console.error).toHaveBeenCalledOnce();
    const registrado = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(registrado).not.toContain("token-secreto");
  });
});
