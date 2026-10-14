import { describe, expect, it, vi } from "vitest";

import { obterEsquema } from "@/components/ui/useFormulario";
import { esquemaCadastro, esquemaLogin } from "@/lib/validacao/auth";
import { gerarSlug, SENHA_MINIMO, SLUG_MAXIMO } from "@/lib/validacao/regras";

/** Zod baixado sob demanda nos formulários (D-040). */

describe("obterEsquema", () => {
  it("esquema pronto passa direto", async () => {
    await expect(obterEsquema(esquemaLogin)).resolves.toBe(esquemaLogin);
  });

  it("esquema sob demanda é baixado uma vez só", async () => {
    const carregar = vi.fn(async () => esquemaLogin);

    const [a, b] = await Promise.all([obterEsquema(carregar), obterEsquema(carregar)]);
    await obterEsquema(carregar);

    expect(a).toBe(esquemaLogin);
    expect(b).toBe(esquemaLogin);
    expect(carregar).toHaveBeenCalledTimes(1);
  });

  it("sem rede, a próxima tentativa baixa de novo", async () => {
    const carregar = vi
      .fn<() => Promise<typeof esquemaLogin>>()
      .mockRejectedValueOnce(new Error("sem rede"))
      .mockResolvedValue(esquemaLogin);

    await expect(obterEsquema(carregar)).rejects.toThrow("sem rede");
    await expect(obterEsquema(carregar)).resolves.toBe(esquemaLogin);
    expect(carregar).toHaveBeenCalledTimes(2);
  });
});

describe("regras sem Zod", () => {
  it("o esquema do servidor usa o mesmo mínimo de senha que o navegador mostra", () => {
    const pessoa = { nome: "Maria Souza", email: "maria@empresa.example" };

    expect(
      esquemaCadastro.safeParse({ ...pessoa, senha: "x".repeat(SENHA_MINIMO - 1) }).success,
    ).toBe(false);
    expect(esquemaCadastro.safeParse({ ...pessoa, senha: "x".repeat(SENHA_MINIMO) }).success).toBe(
      true,
    );
  });

  it("gera o endereço do formulário a partir do nome, no tamanho máximo", () => {
    expect(gerarSlug("Agência Pixel & Cia.")).toBe("agencia-pixel-cia");
    expect(gerarSlug("a".repeat(100))).toHaveLength(SLUG_MAXIMO);
  });
});
