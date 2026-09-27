import { describe, expect, it } from "vitest";

import { ambienteQueMigra } from "../../scripts/banco/ambienteDoDeploy";

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
