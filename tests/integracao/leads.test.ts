import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Empresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import {
  atualizarStatusDaAnalise,
  atualizarStatusDoLead,
  criarLead,
  excluirLead,
  listarLeads,
  obterLead,
  type DadosDeNovoLead,
} from "@/server/repositories/leads";

import { criarBancoDeTeste, criarEmpresaDeTeste } from "./banco";

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
});

afterAll(async () => {
  await encerrar();
});

function dadosDeLead(sobrescrever: Partial<DadosDeNovoLead> = {}): DadosDeNovoLead {
  return {
    nome: "Maria Souza",
    email: "maria@metalurgica.example",
    telefone: "(24) 90000-0001",
    empresaNome: "Metalúrgica Souza",
    segmento: "Indústria",
    mensagem: "Quero um site novo.",
    consentimentoLgpd: true,
    consentimentoEm: new Date(),
    ...sobrescrever,
  };
}

describe("isolamento entre empresas", () => {
  let empresaA: Empresa;
  let empresaB: Empresa;
  let leadDeA: string;

  beforeAll(async () => {
    empresaA = await criarEmpresaDeTeste(db);
    empresaB = await criarEmpresaDeTeste(db);
    leadDeA = (await criarLead(db, empresaA.id, dadosDeLead())).id;
  });

  it("a empresa dona enxerga o lead", async () => {
    expect(await obterLead(db, empresaA.id, leadDeA)).toMatchObject({ id: leadDeA });
  });

  it("outra empresa não obtém, não lista, não altera e não exclui o lead", async () => {
    expect(await obterLead(db, empresaB.id, leadDeA)).toBeUndefined();
    expect((await listarLeads(db, empresaB.id)).total).toBe(0);
    expect(await atualizarStatusDoLead(db, empresaB.id, leadDeA, "ganho")).toBeUndefined();
    expect(await atualizarStatusDaAnalise(db, empresaB.id, leadDeA, "falhou")).toBe(false);
    expect(await excluirLead(db, empresaB.id, leadDeA)).toBe(false);

    const intacto = await obterLead(db, empresaA.id, leadDeA);
    expect(intacto).toMatchObject({ status: "novo", statusAnalise: "pendente", deletedAt: null });
  });

  it("o empresaId dos dados não consegue trocar a empresa do lead", async () => {
    const tentativa = { ...dadosDeLead(), empresaId: empresaB.id } as DadosDeNovoLead;

    const lead = await criarLead(db, empresaA.id, tentativa);

    expect(lead.empresaId).toBe(empresaA.id);
  });

  it("id malformado responde 'não encontrado' em vez de erro do banco", async () => {
    expect(await obterLead(db, empresaA.id, "1 OR 1=1")).toBeUndefined();
    expect(await excluirLead(db, empresaA.id, "nao-e-uuid")).toBe(false);
  });
});

describe("exclusão lógica", () => {
  it("o lead excluído some das consultas, mas continua no banco", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const lead = await criarLead(db, empresa.id, dadosDeLead());

    expect(await excluirLead(db, empresa.id, lead.id)).toBe(true);

    expect(await obterLead(db, empresa.id, lead.id)).toBeUndefined();
    expect((await listarLeads(db, empresa.id)).total).toBe(0);
    expect(await excluirLead(db, empresa.id, lead.id)).toBe(false);

    const noBanco = await db.execute<{ deleted_at: string | null }>(
      sql`SELECT deleted_at FROM leads WHERE id = ${lead.id}`,
    );
    expect(noBanco.rows[0]?.deleted_at).not.toBeNull();
  });
});

describe("listagem com filtros e paginação", () => {
  let empresa: Empresa;

  beforeAll(async () => {
    empresa = await criarEmpresaDeTeste(db);
    for (let i = 1; i <= 25; i += 1) {
      await criarLead(db, empresa.id, dadosDeLead({ nome: `Lead ${String(i).padStart(2, "0")}` }));
    }
    await criarLead(
      db,
      empresa.id,
      dadosDeLead({
        nome: "Carlos Pereira",
        email: "carlos@padaria.example",
        empresaNome: "Padaria 100%",
      }),
    );
  });

  it("pagina no servidor e informa o total", async () => {
    const pagina1 = await listarLeads(db, empresa.id, {}, { pagina: 1, porPagina: 10 });
    const pagina3 = await listarLeads(db, empresa.id, {}, { pagina: 3, porPagina: 10 });

    expect(pagina1).toMatchObject({ total: 26, totalPaginas: 3, pagina: 1 });
    expect(pagina1.itens).toHaveLength(10);
    expect(pagina3.itens).toHaveLength(6);
  });

  it("não repete nem pula itens entre páginas", async () => {
    const ids = new Set<string>();
    for (let pagina = 1; pagina <= 3; pagina += 1) {
      const resultado = await listarLeads(db, empresa.id, {}, { pagina, porPagina: 10 });
      resultado.itens.forEach((lead) => ids.add(lead.id));
    }
    expect(ids.size).toBe(26);
  });

  it("recusa páginas maiores que o máximo permitido", async () => {
    await expect(listarLeads(db, empresa.id, {}, { porPagina: 1000 })).rejects.toThrow();
  });

  it("busca por trecho no nome, e-mail ou empresa, sem diferenciar maiúsculas", async () => {
    expect((await listarLeads(db, empresa.id, { busca: "CARLOS" })).total).toBe(1);
    expect((await listarLeads(db, empresa.id, { busca: "padaria.example" })).total).toBe(1);
    expect((await listarLeads(db, empresa.id, { busca: "Padaria" })).total).toBe(1);
  });

  it("trata % e _ digitados como texto, não como curinga", async () => {
    expect((await listarLeads(db, empresa.id, { busca: "%" })).total).toBe(1);
    expect((await listarLeads(db, empresa.id, { busca: "_" })).total).toBe(0);
  });

  it("filtra por status, classificação e período", async () => {
    const [primeiro] = (await listarLeads(db, empresa.id, {}, { porPagina: 1 })).itens;
    if (!primeiro) {
      expect.unreachable("deveria haver leads");
    }
    await atualizarStatusDoLead(db, empresa.id, primeiro.id, "ganho");

    expect((await listarLeads(db, empresa.id, { status: "ganho" })).total).toBe(1);
    expect((await listarLeads(db, empresa.id, { classificacao: "quente" })).total).toBe(0);
    expect((await listarLeads(db, empresa.id, { criadoAte: new Date(2000, 0, 1) })).total).toBe(0);
    expect((await listarLeads(db, empresa.id, { criadoDe: new Date(2000, 0, 1) })).total).toBe(26);
  });

  it("ordena por nome", async () => {
    const { itens } = await listarLeads(
      db,
      empresa.id,
      { ordenarPor: "nome", direcao: "asc" },
      { porPagina: 2 },
    );
    expect(itens.map((lead) => lead.nome)).toEqual(["Carlos Pereira", "Lead 01"]);
  });
});
