import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditoria, usuarios } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { ErroConflito, ErroNaoEncontrado } from "@/lib/erros";
import { promoverPrimeiroAdmin } from "@/server/services/administracao";

import { criarBancoDeTeste } from "./banco";

/** Primeiro admin da implantação (D-031), com o banco real (PGlite) e sem nenhum admin. */

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
});

afterAll(async () => {
  await encerrar();
});

async function novaConta(email: string, bloqueada = false) {
  const [usuario] = await db
    .insert(usuarios)
    .values({ nome: "Fernanda Fundadora", email, bloqueadoEm: bloqueada ? new Date() : null })
    .returning();
  if (!usuario) {
    throw new Error("usuário não criado");
  }
  return usuario;
}

describe("promoverPrimeiroAdmin", () => {
  it("recusa e-mail sem conta e conta bloqueada, sem promover ninguém", async () => {
    await novaConta("bloqueada@teste.example", true);

    await expect(promoverPrimeiroAdmin(db, "ninguem@teste.example")).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    );
    await expect(promoverPrimeiroAdmin(db, "bloqueada@teste.example")).rejects.toBeInstanceOf(
      ErroConflito,
    );
    const admins = await db.select().from(usuarios).where(eq(usuarios.papelPlataforma, "admin"));
    expect(admins).toEqual([]);
  });

  it("promove a conta (e-mail sem diferenciar maiúsculas) e registra na auditoria como do sistema", async () => {
    const conta = await novaConta("fundadora@teste.example");

    const promovida = await promoverPrimeiroAdmin(db, "  Fundadora@Teste.Example ");

    expect(promovida).toEqual({ usuarioId: conta.id, nome: "Fernanda Fundadora" });
    const [atualizada] = await db.select().from(usuarios).where(eq(usuarios.id, conta.id));
    expect(atualizada?.papelPlataforma).toBe("admin");
    const registros = await db
      .select()
      .from(auditoria)
      .where(and(eq(auditoria.acao, "usuario.papel_alterado"), eq(auditoria.recursoId, conta.id)));
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      atorId: null,
      empresaId: null,
      detalhes: { de: "cliente", para: "admin", origem: "primeiro_admin" },
    });
  });

  it("com um admin ativo, recusa: os próximos são promovidos pela tela Usuários", async () => {
    const outra = await novaConta("segunda@teste.example");

    await expect(promoverPrimeiroAdmin(db, "segunda@teste.example")).rejects.toThrow(
      "A plataforma já tem admin ativo",
    );
    const [inalterada] = await db.select().from(usuarios).where(eq(usuarios.id, outra.id));
    expect(inalterada?.papelPlataforma).toBeNull();
  });
});
