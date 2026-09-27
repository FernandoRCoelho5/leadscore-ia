import { describe, expect, it } from "vitest";

import { ambienteQueMigra } from "../../scripts/banco/ambienteDoDeploy";
import { motivoParaRecusarSeed } from "../../scripts/banco/travaDoSeed";

/** Quando o build aplica as migrations (D-031). */
describe("ambienteQueMigra", () => {
  it("migra nos builds de produção e de preview da Vercel", () => {
    expect(ambienteQueMigra({ VERCEL: "1", VERCEL_ENV: "production" })).toBe("production");
    expect(ambienteQueMigra({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe("preview");
  });

  it("não migra fora da Vercel, mesmo com VERCEL_ENV copiado para a máquina", () => {
    expect(ambienteQueMigra({})).toBeNull();
    expect(ambienteQueMigra({ VERCEL_ENV: "production" })).toBeNull();
    expect(ambienteQueMigra({ VERCEL: "0", VERCEL_ENV: "production" })).toBeNull();
  });

  it("não migra no ambiente development da Vercel nem com valor desconhecido", () => {
    expect(ambienteQueMigra({ VERCEL: "1", VERCEL_ENV: "development" })).toBeNull();
    expect(ambienteQueMigra({ VERCEL: "1", VERCEL_ENV: "Production" })).toBeNull();
    expect(ambienteQueMigra({ VERCEL: "1" })).toBeNull();
  });
});

/** O seed de demonstração nunca roda em produção (D-031). */
describe("motivoParaRecusarSeed", () => {
  it("libera bancos só com contas de demonstração, de teste ou anonimizadas", () => {
    expect(motivoParaRecusarSeed({ ambiente: undefined, contasReais: 0 })).toBeNull();
    expect(motivoParaRecusarSeed({ ambiente: "preview", contasReais: 0 })).toBeNull();
  });

  it("recusa com VERCEL_ENV=production, mesmo com o banco vazio", () => {
    expect(motivoParaRecusarSeed({ ambiente: "production", contasReais: 0 })).toContain(
      "não roda em produção",
    );
  });

  it("recusa banco com contas reais (ex.: .env.local apontando para a produção)", () => {
    expect(motivoParaRecusarSeed({ ambiente: undefined, contasReais: 3 })).toContain(
      "3 conta(s) com e-mail real",
    );
  });
});
