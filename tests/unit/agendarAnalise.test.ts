import { beforeEach, describe, expect, it, vi } from "vitest";

import { agendarAnalise } from "@/server/http/agendarAnalise";
import { analisarLead } from "@/server/services/analise";

/** Agendamento com `after()` (D-007): nada roda antes da resposta ao visitante. */

const simulado = vi.hoisted(() => ({ tarefas: [] as (() => Promise<void>)[] }));

vi.mock("next/server", () => ({
  after: (tarefa: () => Promise<void>) => {
    simulado.tarefas.push(tarefa);
  },
}));
vi.mock("@/db", () => ({ db: { banco: "simulado" } }));
vi.mock("@/server/ia", () => ({ obterMotor: () => ({ motor: "simulado" }) }));
vi.mock("@/server/services/analise", () => ({ analisarLead: vi.fn() }));

const EMPRESA = "0199a000-0000-7000-8000-00000000000e";
const LEAD = "0199a000-0000-7000-8000-00000000000f";

beforeEach(() => {
  simulado.tarefas.length = 0;
  vi.mocked(analisarLead).mockReset();
});

describe("agendarAnalise", () => {
  it("só agenda: a análise roda depois da resposta", async () => {
    agendarAnalise(EMPRESA, LEAD);

    expect(analisarLead).not.toHaveBeenCalled();
    expect(simulado.tarefas).toHaveLength(1);

    await simulado.tarefas[0]?.();

    expect(analisarLead).toHaveBeenCalledWith(
      { banco: "simulado" },
      { motor: "simulado" },
      EMPRESA,
      LEAD,
    );
  });

  it("um erro na análise vai para o log e não derruba nada", async () => {
    vi.mocked(analisarLead).mockRejectedValue(new Error("banco fora do ar"));
    const erroNoLog = vi.spyOn(console, "error").mockImplementation(() => {});

    agendarAnalise(EMPRESA, LEAD);
    await expect(simulado.tarefas[0]?.()).resolves.toBeUndefined();

    expect(String(erroNoLog.mock.calls[0]?.[0])).toContain(
      "Falha ao analisar lead em segundo plano",
    );
    erroNoLog.mockRestore();
  });
});
