import { describe, expect, it } from "vitest";

import { MINUTOS_ATE_CONSIDERAR_PARADA, situacaoDaAnalise } from "@/lib/analise";
import { ROTULO_DA_SITUACAO_DA_ANALISE } from "@/lib/rotulos";

const AGORA = new Date("2026-10-13T15:00:00-03:00");
const minutosAtras = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000);
const LOGO_DEPOIS_DO_LIMITE = MINUTOS_ATE_CONSIDERAR_PARADA + 1;

function lead(
  statusAnalise: Parameters<typeof situacaoDaAnalise>[0]["statusAnalise"],
  criadoHa: number,
  atualizadoHa = criadoHa,
) {
  return {
    statusAnalise,
    createdAt: minutosAtras(criadoHa),
    updatedAt: minutosAtras(atualizadoHa),
  };
}

describe("situação da análise", () => {
  it("lead recém-chegado continua aguardando a análise", () => {
    expect(situacaoDaAnalise(lead("pendente", 1), AGORA)).toBe("pendente");
  });

  it("lead pendente há mais tempo que o limite: a análise não começou", () => {
    expect(situacaoDaAnalise(lead("pendente", LOGO_DEPOIS_DO_LIMITE), AGORA)).toBe("nao_iniciada");
    expect(situacaoDaAnalise(lead("pendente", 60 * 24 * 18), AGORA)).toBe("nao_iniciada");
  });

  it("processando conta do início da análise (updatedAt), não da chegada do lead", () => {
    // Reanálise de um lead antigo, começada agora: ainda está rodando.
    expect(situacaoDaAnalise(lead("processando", 60 * 24 * 30, 1), AGORA)).toBe("processando");
    expect(situacaoDaAnalise(lead("processando", 60 * 24 * 30, LOGO_DEPOIS_DO_LIMITE), AGORA)).toBe(
      "interrompida",
    );
  });

  it("status finais não mudam com o tempo", () => {
    for (const status of ["concluida", "falhou", "limite_atingido"] as const) {
      expect(situacaoDaAnalise(lead(status, 60 * 24 * 30), AGORA)).toBe(status);
    }
  });

  it("toda situação tem um rótulo para a tela", () => {
    expect(ROTULO_DA_SITUACAO_DA_ANALISE.nao_iniciada).toBe("Análise não iniciada");
    expect(ROTULO_DA_SITUACAO_DA_ANALISE.interrompida).toBe("Análise interrompida");
    expect(ROTULO_DA_SITUACAO_DA_ANALISE.pendente).toBe("Aguardando análise");
  });
});
