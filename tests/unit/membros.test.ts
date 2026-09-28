import { describe, expect, it } from "vitest";

import { mascararEmail } from "@/lib/privacidade";
import { esquemaConvite } from "@/lib/validacao/membros";
import { gerarToken, hashDoToken, temFormatoDeToken } from "@/server/seguranca/tokens";

describe("token do convite", () => {
  it("tem 256 bits em base64url e o banco recebe só o SHA-256", () => {
    const { token, hash } = gerarToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashDoToken(token));
    expect(hash).not.toContain(token);
  });

  it("cada token é único", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => gerarToken().token));

    expect(tokens.size).toBe(200);
  });

  it("descarta o que nem tem o formato de token, sem ir ao banco", () => {
    expect(temFormatoDeToken(gerarToken().token)).toBe(true);
    expect(temFormatoDeToken("abc")).toBe(false);
    expect(temFormatoDeToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(temFormatoDeToken(`../${"a".repeat(40)}`)).toBe(false);
  });
});

describe("e-mail do convite", () => {
  it("normaliza (espaços e maiúsculas) e valida", () => {
    expect(esquemaConvite.parse({ email: "  Ana@Empresa.COM " })).toEqual({
      email: "ana@empresa.com",
    });
    expect(esquemaConvite.safeParse({ email: "ana" }).success).toBe(false);
  });

  it("aparece mascarado na página do convite", () => {
    expect(mascararEmail("fernanda@empresa.com.br")).toBe("f•••••••@empresa.com.br");
    expect(mascararEmail("al@x.com")).toBe("a•••@x.com");
    expect(mascararEmail("um-nome-muito-comprido@x.com")).toBe("u••••••••@x.com");
    expect(mascararEmail("sem-arroba")).toBe("•••");
  });
});
