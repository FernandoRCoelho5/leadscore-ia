import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { BancoDeDados } from "@/db/tipos";
import {
  listarAnalisesDoLead,
  registrarAnalise,
  type DadosDaAnalise,
} from "@/server/repositories/analises";
import { criarLead, listarLeads, obterLead } from "@/server/repositories/leads";

import { criarBancoDeTeste, criarEmpresaDeTeste } from "./banco";

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
});

afterAll(async () => {
  await encerrar();
});

function dadosDeAnalise(sobrescrever: Partial<DadosDaAnalise> = {}): DadosDaAnalise {
  return {
    score: 85,
    classificacao: "quente",
    justificativa: "Aderente ao cliente ideal e com urgência.",
    respostaSugerida: "Olá! Podemos conversar amanhã?",
    modelo: "claude-haiku-4-5-20251001",
    promptVersion: "v1",
    perfilVersao: 1,
    tokensEntrada: 900,
    tokensSaida: 200,
    tempoRespostaMs: 1800,
    mock: true,
    ...sobrescrever,
  };
}

async function novoLead(empresaId: string) {
  return criarLead(db, empresaId, { nome: "Ana", consentimentoLgpd: true });
}

describe("registrarAnalise", () => {
  it("grava a análise e copia score e classificação para o lead", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const lead = await novoLead(empresa.id);

    const analise = await registrarAnalise(db, empresa.id, lead.id, dadosDeAnalise());

    expect(analise).toMatchObject({ leadId: lead.id, empresaId: empresa.id, score: 85 });
    expect(await obterLead(db, empresa.id, lead.id)).toMatchObject({
      scoreAtual: 85,
      classificacaoAtual: "quente",
      statusAnalise: "concluida",
    });
    expect((await listarLeads(db, empresa.id, { classificacao: "quente" })).total).toBe(1);
  });

  it("reanálise preserva o histórico e atualiza a cópia com a mais recente", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const lead = await novoLead(empresa.id);

    await registrarAnalise(db, empresa.id, lead.id, dadosDeAnalise({ score: 85 }));
    await registrarAnalise(
      db,
      empresa.id,
      lead.id,
      dadosDeAnalise({ score: 30, classificacao: "frio" }),
    );

    const historico = await listarAnalisesDoLead(db, empresa.id, lead.id);
    expect(historico.map((a) => a.score)).toEqual([30, 85]);
    expect(await obterLead(db, empresa.id, lead.id)).toMatchObject({
      scoreAtual: 30,
      classificacaoAtual: "frio",
    });
  });

  it("não grava análise em lead de outra empresa", async () => {
    const dona = await criarEmpresaDeTeste(db);
    const outra = await criarEmpresaDeTeste(db);
    const lead = await novoLead(dona.id);

    expect(await registrarAnalise(db, outra.id, lead.id, dadosDeAnalise())).toBeUndefined();
    expect(await listarAnalisesDoLead(db, dona.id, lead.id)).toEqual([]);
    expect(await listarAnalisesDoLead(db, outra.id, lead.id)).toEqual([]);
  });

  it("o banco recusa score fora da faixa de 0 a 100", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const lead = await novoLead(empresa.id);

    await expect(
      registrarAnalise(db, empresa.id, lead.id, dadosDeAnalise({ score: 101 })),
    ).rejects.toThrow();
    // A transação foi desfeita: o lead não ficou com a cópia inválida.
    expect(await obterLead(db, empresa.id, lead.id)).toMatchObject({
      scoreAtual: null,
      statusAnalise: "pendente",
    });
  });
});
