import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditoria } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { registrarAuditoria } from "@/server/repositories/auditoria";
import { obterEmpresa, obterEmpresaAtivaPorSlug } from "@/server/repositories/empresas";
import {
  competenciaDe,
  consumirAnalise,
  obterUsoDoMes,
  registrarTokens,
} from "@/server/repositories/usoMensal";

import { criarBancoDeTeste, criarEmpresaDeTeste } from "./banco";

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
});

afterAll(async () => {
  await encerrar();
});

describe("empresas", () => {
  it("encontra a empresa ativa pelo slug do formulário", async () => {
    const empresa = await criarEmpresaDeTeste(db);

    expect(await obterEmpresaAtivaPorSlug(db, empresa.slug)).toMatchObject({ id: empresa.id });
    expect(await obterEmpresa(db, empresa.id)).toMatchObject({ slug: empresa.slug });
  });

  it("empresa bloqueada não recebe leads pelo formulário", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    await db.execute(sql`UPDATE empresas SET status = 'bloqueada' WHERE id = ${empresa.id}`);

    expect(await obterEmpresaAtivaPorSlug(db, empresa.slug)).toBeUndefined();
  });

  it("o banco impede dois slugs iguais entre empresas ativas", async () => {
    const empresa = await criarEmpresaDeTeste(db);

    await expect(
      db.execute(
        sql`INSERT INTO empresas (id, nome, slug) VALUES (gen_random_uuid(), 'Cópia', ${empresa.slug})`,
      ),
    ).rejects.toThrow();
  });
});

describe("uso mensal", () => {
  it("usa o mês no fuso de São Paulo", () => {
    // 01/10 às 01h em UTC ainda é 30/09 em São Paulo (UTC-3).
    expect(competenciaDe(new Date("2026-10-01T01:00:00Z"))).toBe("2026-09-01");
    expect(competenciaDe(new Date("2026-10-01T04:00:00Z"))).toBe("2026-10-01");
  });

  it("consome até o limite e depois recusa", async () => {
    const empresa = await criarEmpresaDeTeste(db, 2);

    expect(await consumirAnalise(db, empresa.id, 2, "2026-09-01")).toBe(true);
    expect(await consumirAnalise(db, empresa.id, 2, "2026-09-01")).toBe(true);
    expect(await consumirAnalise(db, empresa.id, 2, "2026-09-01")).toBe(false);
    expect((await obterUsoDoMes(db, empresa.id, "2026-09-01"))?.analises).toBe(2);
  });

  it("um mês novo começa com saldo cheio", async () => {
    const empresa = await criarEmpresaDeTeste(db, 1);

    expect(await consumirAnalise(db, empresa.id, 1, "2026-09-01")).toBe(true);
    expect(await consumirAnalise(db, empresa.id, 1, "2026-10-01")).toBe(true);
  });

  it("limite zero bloqueia qualquer análise", async () => {
    const empresa = await criarEmpresaDeTeste(db, 0);

    expect(await consumirAnalise(db, empresa.id, 0, "2026-09-01")).toBe(false);
    expect(await obterUsoDoMes(db, empresa.id, "2026-09-01")).toBeUndefined();
  });

  it("pedidos simultâneos nunca ultrapassam o limite", async () => {
    const empresa = await criarEmpresaDeTeste(db, 5);

    const resultados = await Promise.all(
      Array.from({ length: 12 }, () => consumirAnalise(db, empresa.id, 5, "2026-09-01")),
    );

    expect(resultados.filter(Boolean)).toHaveLength(5);
    expect((await obterUsoDoMes(db, empresa.id, "2026-09-01"))?.analises).toBe(5);
  });

  it("acumula os tokens gastos no mês", async () => {
    const empresa = await criarEmpresaDeTeste(db);

    await registrarTokens(db, empresa.id, { entrada: 1000, saida: 200 }, "2026-09-01");
    await registrarTokens(db, empresa.id, { entrada: 500, saida: 100 }, "2026-09-01");

    expect(await obterUsoDoMes(db, empresa.id, "2026-09-01")).toMatchObject({
      tokensEntrada: 1500,
      tokensSaida: 300,
    });
  });
});

describe("auditoria", () => {
  it("registra o evento sem exigir ator (ações do sistema)", async () => {
    const empresa = await criarEmpresaDeTeste(db);

    await registrarAuditoria(db, {
      empresaId: empresa.id,
      acao: "lead.exportado",
      recursoTipo: "lead",
      detalhes: { quantidade: 10 },
    });

    const eventos = await db
      .select({ acao: auditoria.acao })
      .from(auditoria)
      .where(eq(auditoria.empresaId, empresa.id));
    expect(eventos).toEqual([{ acao: "lead.exportado" }]);
  });
});
