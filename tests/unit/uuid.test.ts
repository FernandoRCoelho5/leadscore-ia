import { describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/uuid";

describe("uuidv7", () => {
  it("segue o formato UUID com versão 7 e variante RFC", () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("codifica o horário nos primeiros 48 bits", () => {
    const horario = Date.UTC(2026, 8, 25, 12, 0, 0);
    const hexDoHorario = uuidv7(horario).replace("-", "").slice(0, 12);

    expect(parseInt(hexDoHorario, 16)).toBe(horario);
  });

  it("IDs criados depois ficam em ordem crescente", () => {
    const antes = uuidv7(1_000);
    const depois = uuidv7(2_000);

    expect(antes < depois).toBe(true);
  });

  it("não se repete", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()));
    expect(ids.size).toBe(1000);
  });
});
