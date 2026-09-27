import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { leads, type Empresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { listarLeads, lotesDeLeadsParaExportar } from "@/server/repositories/leads";

import { criarBancoDeTeste, criarEmpresaDeTeste } from "./banco";

/**
 * Escala (D-014): com milhares de leads, as consultas do painel usam os
 * índices em vez de ler a tabela inteira. O teste roda as funções reais do
 * repositório, captura o SQL que o Drizzle gerou e pede o plano ao Postgres
 * (EXPLAIN). Tempo não é medido aqui (varia de máquina para máquina); o plano
 * é o que garante que o custo não cresce com o tamanho da tabela.
 */

let db: BancoDeDados;
let cliente: PGlite;
let encerrar: () => Promise<void>;
const consultas: { sql: string; parametros: unknown[] }[] = [];

let grande: Empresa;
let pequena: Empresa;

const CLASSIFICACOES = ["quente", "morno", "frio"] as const;
const NOMES = ["Silva", "Souza", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida", "Nunes"];

async function inserirLeads(empresa: Empresa, quantidade: number): Promise<void> {
  const agora = Date.now();
  for (let inicio = 0; inicio < quantidade; inicio += 1000) {
    const lote = Array.from({ length: Math.min(1000, quantidade - inicio) }, (_, i) => {
      const n = inicio + i;
      const criadoEm = new Date(agora - (n % 365) * 86_400_000 - n * 1000);
      return {
        empresaId: empresa.id,
        nome: `Pessoa ${NOMES[n % NOMES.length]} ${n}`,
        email: `lead${n}@empresa${n % 97}.example`,
        empresaNome: `Empresa ${n % 500}`,
        consentimentoLgpd: true,
        statusAnalise: "concluida" as const,
        scoreAtual: n % 101,
        classificacaoAtual: CLASSIFICACOES[n % 3],
        createdAt: criadoEm,
        updatedAt: criadoEm,
      };
    });
    await db.insert(leads).values(lote);
  }
}

/** Plano (texto) da última consulta de leitura de leads com LIMIT. */
async function planoDaUltimaConsulta(): Promise<string> {
  const consulta = [...consultas]
    .reverse()
    .find(({ sql }) => /^select/i.test(sql) && sql.includes('from "leads"') && /limit/i.test(sql));
  if (!consulta) {
    throw new Error("nenhuma consulta de leads capturada");
  }
  const { rows } = await cliente.query<{ "QUERY PLAN": string }>(
    `EXPLAIN ${consulta.sql}`,
    consulta.parametros,
  );
  return rows.map((linha) => linha["QUERY PLAN"]).join("\n");
}

beforeAll(async () => {
  ({ db, cliente, encerrar } = await criarBancoDeTeste({
    aoConsultar: (sql, parametros) => consultas.push({ sql, parametros }),
  }));
  grande = await criarEmpresaDeTeste(db);
  pequena = await criarEmpresaDeTeste(db);
  await inserirLeads(grande, 20_000);
  await inserirLeads(pequena, 300);
  await cliente.exec("ANALYZE leads");
}, 120_000);

afterAll(async () => {
  await encerrar();
});

describe("planos das consultas com milhares de leads", () => {
  it("a lista padrão (mais recentes) lê só a página pelo índice (empresa, data)", async () => {
    await listarLeads(db, grande.id, {}, { pagina: 1 });

    const plano = await planoDaUltimaConsulta();
    expect(plano).toContain("leads_empresa_criado_idx");
    expect(plano).not.toContain("Seq Scan");
  });

  it("o filtro por classificação usa o índice (empresa, classificação, data)", async () => {
    await listarLeads(db, grande.id, { classificacao: "quente" }, { pagina: 1 });

    const plano = await planoDaUltimaConsulta();
    expect(plano).toContain("leads_empresa_classificacao_idx");
    expect(plano).not.toContain("Seq Scan");
  });

  it('"Maior nota" sai pronta do índice, sem ordenar os leads da empresa', async () => {
    await listarLeads(db, grande.id, { ordenarPor: "score", direcao: "desc" }, { pagina: 1 });

    const plano = await planoDaUltimaConsulta();
    expect(plano).toContain("leads_empresa_score_idx");
    expect(plano).not.toContain("Sort");
    expect(plano).not.toContain("Seq Scan");
  });

  it("a exportação de uma empresa pequena lê só os leads dela, lote a lote", async () => {
    const lotes = lotesDeLeadsParaExportar(db, pequena.id, {}, 100);
    await lotes.next();
    await lotes.next(); // o segundo lote já usa o cursor (id < último lido)

    const plano = await planoDaUltimaConsulta();
    await lotes.return(undefined);
    expect(plano).toContain("leads_empresa_id_idx");
    expect(plano).toMatch(/Index Cond: .*empresa_id.*AND.*id </);
  });

  it("a exportação percorre todos os leads uma única vez", async () => {
    const vistos = new Set<string>();
    let total = 0;
    for await (const lote of lotesDeLeadsParaExportar(db, grande.id, {}, 500)) {
      total += lote.length;
      for (const lead of lote) {
        vistos.add(lead.id);
      }
    }

    expect(total).toBe(20_000);
    expect(vistos.size).toBe(20_000);
  });

  it("a busca numa empresa procura o trecho só entre os leads dela", async () => {
    // O ILIKE '%termo%' parte do índice da empresa e filtra só os leads dela:
    // o custo acompanha o tamanho da empresa, não o da tabela inteira (com
    // 20 mil leads de outra empresa ao lado).
    await listarLeads(db, pequena.id, { busca: "silva 12" }, { pagina: 1 });

    const plano = await planoDaUltimaConsulta();
    expect(plano).toMatch(/leads_empresa_\w+_idx/);
    expect(plano).not.toContain("Seq Scan");
  });
});
