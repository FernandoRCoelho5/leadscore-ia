import { and, eq, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditoria, convites, empresas, membrosEmpresa, usuarios, type Empresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import {
  ErroConflito,
  ErroLimiteExcedido,
  ErroNaoEncontrado,
  ErroProibido,
  ErroValidacao,
} from "@/lib/erros";
import type { Papel } from "@/server/auth/permissoes";
import { registrarAuditoria } from "@/server/repositories/auditoria";
import { criarVinculo, listarEmpresasDoUsuario } from "@/server/repositories/usuarios";
import { hashDoToken } from "@/server/seguranca/tokens";
import {
  alterarBloqueioNaPlataforma,
  alterarPapelNaPlataforma,
} from "@/server/services/administracao";
import type { ContextoDoUsuario } from "@/server/services/contexto";
import {
  aceitarConvite,
  cancelarConviteDaEmpresa,
  consultarConvite,
  CONVITES_PENDENTES_POR_EMPRESA,
  CONVITES_POR_HORA,
  convidarPessoa,
  listarConvitesDaEmpresa,
  listarMembrosDaEmpresa,
  removerMembroDaEmpresa,
} from "@/server/services/membros";

import { criarBancoDeTeste, criarEmpresaDeTeste } from "./banco";

/** Membros, convites (D-030) e perfis de acesso com o banco real (PGlite). */

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
});

afterAll(async () => {
  await encerrar();
});

let sequencia = 0;

type Pessoa = ContextoDoUsuario & { email: string };

async function novaPessoa(papel: Papel = "cliente", empresa?: Empresa): Promise<Pessoa> {
  sequencia += 1;
  const email = `pessoa-membros-${sequencia}@teste.example`;
  const [usuario] = await db
    .insert(usuarios)
    .values({
      nome: `Pessoa ${sequencia}`,
      email,
      papelPlataforma: papel === "cliente" ? null : papel,
    })
    .returning();
  if (!usuario) {
    throw new Error("usuário não criado");
  }
  if (empresa) {
    await criarVinculo(db, usuario.id, empresa.id);
  }
  return {
    usuarioId: usuario.id,
    email,
    ator: { papel, empresaIds: empresa ? [empresa.id] : [] },
  };
}

/** Empresa com uma pessoa (a dona), que gere os membros. */
async function empresaComDona() {
  const empresa = await criarEmpresaDeTeste(db);
  const dona = await novaPessoa("cliente", empresa);
  return { empresa, dona };
}

async function eventos(acao: string, recursoId: string) {
  return db
    .select()
    .from(auditoria)
    .where(and(eq(auditoria.acao, acao), eq(auditoria.recursoId, recursoId)));
}

describe("convites", () => {
  it("guarda só o hash do token e registra o convite sem o e-mail", async () => {
    const { empresa, dona } = await empresaComDona();

    const convite = await convidarPessoa(db, dona, empresa.id, { email: "  Nova@Teste.Example " });

    expect(convite.email).toBe("nova@teste.example");
    const [gravado] = await db.select().from(convites).where(eq(convites.id, convite.conviteId));
    expect(gravado?.tokenHash).toBe(hashDoToken(convite.token));
    expect(JSON.stringify(gravado)).not.toContain(convite.token);
    const [evento] = await eventos("convite.criado", convite.conviteId);
    expect(evento).toMatchObject({ atorId: dona.usuarioId, empresaId: empresa.id, detalhes: {} });
    expect(await consultarConvite(db, convite.token)).toEqual({
      situacao: "valido",
      empresaNome: empresa.nome,
      email: "nova@teste.example",
    });
  });

  it("recusa quem já é membro e convite repetido, com o erro no campo e-mail", async () => {
    const { empresa, dona } = await empresaComDona();
    const colega = await novaPessoa("cliente", empresa);
    await convidarPessoa(db, dona, empresa.id, { email: "repetido@teste.example" });

    for (const email of [colega.email, "repetido@teste.example"]) {
      const tentativa = convidarPessoa(db, dona, empresa.id, { email });
      await expect(tentativa).rejects.toBeInstanceOf(ErroValidacao);
      await expect(tentativa).rejects.toMatchObject({ detalhes: [{ campo: "email" }] });
    }
    await expect(
      convidarPessoa(db, dona, empresa.id, { email: "sem-arroba" }),
    ).rejects.toBeInstanceOf(ErroValidacao);
  });

  it("tem teto de convites pendentes por empresa e de convites por hora por pessoa", async () => {
    const { empresa, dona } = await empresaComDona();
    for (let vez = 0; vez < CONVITES_PENDENTES_POR_EMPRESA; vez += 1) {
      await convidarPessoa(db, dona, empresa.id, { email: `fila-${vez}@teste.example` });
    }
    await expect(
      convidarPessoa(db, dona, empresa.id, { email: "sobra@teste.example" }),
    ).rejects.toBeInstanceOf(ErroConflito);

    const outra = await empresaComDona();
    for (let vez = 0; vez < CONVITES_POR_HORA; vez += 1) {
      await registrarAuditoria(db, {
        atorId: outra.dona.usuarioId,
        empresaId: outra.empresa.id,
        acao: "convite.criado",
        recursoTipo: "convite",
      });
    }
    await expect(
      convidarPessoa(db, outra.dona, outra.empresa.id, { email: "mais-um@teste.example" }),
    ).rejects.toBeInstanceOf(ErroLimiteExcedido);
  }, 20_000);

  it("o suporte só vê; um cliente não mexe na empresa de outro (nem descobre que existe)", async () => {
    const { empresa } = await empresaComDona();
    const suporte = await novaPessoa("suporte");
    const deFora = await empresaComDona();

    await expect(
      convidarPessoa(db, suporte, empresa.id, { email: "x@teste.example" }),
    ).rejects.toBeInstanceOf(ErroProibido);
    await expect(
      convidarPessoa(db, deFora.dona, empresa.id, { email: "x@teste.example" }),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
    await expect(listarConvitesDaEmpresa(db, suporte, empresa.id)).resolves.toEqual([]);
  });

  it("aceitar cria o vínculo, marca o convite como usado e não se repete", async () => {
    const { empresa, dona } = await empresaComDona();
    const convidada = await novaPessoa();
    const { token, conviteId } = await convidarPessoa(db, dona, empresa.id, {
      email: convidada.email,
    });

    await expect(aceitarConvite(db, convidada, token)).resolves.toEqual({ empresaId: empresa.id });

    expect(await listarEmpresasDoUsuario(db, convidada.usuarioId)).toEqual([
      { empresaId: empresa.id, nome: empresa.nome, slug: empresa.slug },
    ]);
    expect(await eventos("convite.aceito", conviteId)).toHaveLength(1);
    expect(await consultarConvite(db, token)).toMatchObject({ situacao: "usado" });
    await expect(aceitarConvite(db, convidada, token)).rejects.toBeInstanceOf(ErroConflito);
    expect(await listarConvitesDaEmpresa(db, dona, empresa.id)).toEqual([]);
  });

  it("só vale para o e-mail convidado, para clientes e dentro do prazo", async () => {
    const { empresa, dona } = await empresaComDona();
    const convidada = await novaPessoa();
    const intrusa = await novaPessoa();
    const admin = await novaPessoa("admin");
    const { token } = await convidarPessoa(db, dona, empresa.id, { email: convidada.email });

    await expect(aceitarConvite(db, intrusa, token)).rejects.toBeInstanceOf(ErroProibido);
    await expect(aceitarConvite(db, admin, token)).rejects.toBeInstanceOf(ErroProibido);
    const daquiOitoDias = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(await consultarConvite(db, token, daquiOitoDias)).toMatchObject({
      situacao: "expirado",
    });
    await expect(aceitarConvite(db, convidada, token, daquiOitoDias)).rejects.toBeInstanceOf(
      ErroConflito,
    );
    await expect(aceitarConvite(db, convidada, "curto-demais")).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    );
    expect(await consultarConvite(db, "x".repeat(43))).toEqual({ situacao: "invalido" });
  });

  it("convite cancelado ou de empresa bloqueada deixa de valer", async () => {
    const { empresa, dona } = await empresaComDona();
    const cancelado = await convidarPessoa(db, dona, empresa.id, { email: "c1@teste.example" });
    const bloqueado = await convidarPessoa(db, dona, empresa.id, { email: "c2@teste.example" });

    await cancelarConviteDaEmpresa(db, dona, empresa.id, cancelado.conviteId);
    expect(await consultarConvite(db, cancelado.token)).toEqual({ situacao: "invalido" });
    expect(await eventos("convite.cancelado", cancelado.conviteId)).toHaveLength(1);
    await expect(
      cancelarConviteDaEmpresa(db, dona, empresa.id, cancelado.conviteId),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);

    await db.update(empresas).set({ status: "bloqueada" }).where(eq(empresas.id, empresa.id));
    expect(await consultarConvite(db, bloqueado.token)).toEqual({ situacao: "invalido" });
  });
});

describe("membros", () => {
  it("lista as pessoas por nome, com paginação, sem as removidas", async () => {
    const { empresa, dona } = await empresaComDona();
    const colega = await novaPessoa("cliente", empresa);
    const saiu = await novaPessoa("cliente", empresa);
    await removerMembroDaEmpresa(db, dona, empresa.id, saiu.usuarioId);

    const pagina = await listarMembrosDaEmpresa(db, dona, empresa.id, { porPagina: 1 });

    expect(pagina).toMatchObject({ total: 2, totalPaginas: 2 });
    const todos = await listarMembrosDaEmpresa(db, dona, empresa.id, {});
    expect(todos.itens.map((membro) => membro.usuarioId).sort()).toEqual(
      [dona.usuarioId, colega.usuarioId].sort(),
    );
  });

  it("remover é lógico, auditado e tira o acesso na hora", async () => {
    const { empresa, dona } = await empresaComDona();
    const colega = await novaPessoa("cliente", empresa);

    await removerMembroDaEmpresa(db, dona, empresa.id, colega.usuarioId);

    expect(await listarEmpresasDoUsuario(db, colega.usuarioId)).toEqual([]);
    const [vinculo] = await db
      .select()
      .from(membrosEmpresa)
      .where(
        and(eq(membrosEmpresa.usuarioId, colega.usuarioId), isNotNull(membrosEmpresa.deletedAt)),
      );
    expect(vinculo?.empresaId).toBe(empresa.id);
    expect(await eventos("membro.removido", colega.usuarioId)).toHaveLength(1);
  });

  it("ninguém remove a si mesmo, a empresa nunca fica vazia e o suporte não remove", async () => {
    const { empresa, dona } = await empresaComDona();
    const admin = await novaPessoa("admin");
    const suporte = await novaPessoa("suporte");
    const deFora = await novaPessoa();

    await expect(
      removerMembroDaEmpresa(db, dona, empresa.id, dona.usuarioId),
    ).rejects.toBeInstanceOf(ErroConflito);
    await expect(
      removerMembroDaEmpresa(db, admin, empresa.id, dona.usuarioId),
    ).rejects.toBeInstanceOf(ErroConflito);
    await expect(
      removerMembroDaEmpresa(db, suporte, empresa.id, dona.usuarioId),
    ).rejects.toBeInstanceOf(ErroProibido);
    await expect(
      removerMembroDaEmpresa(db, dona, empresa.id, deFora.usuarioId),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
  });

  it("quem foi removido pode ser convidado e entrar de novo", async () => {
    const { empresa, dona } = await empresaComDona();
    const colega = await novaPessoa("cliente", empresa);
    await removerMembroDaEmpresa(db, dona, empresa.id, colega.usuarioId);

    const { token } = await convidarPessoa(db, dona, empresa.id, { email: colega.email });
    await aceitarConvite(db, { ...colega, ator: { papel: "cliente", empresaIds: [] } }, token);

    expect(await listarEmpresasDoUsuario(db, colega.usuarioId)).toHaveLength(1);
  });
});

describe("perfil de acesso (admin)", () => {
  it("promove e rebaixa com auditoria; ninguém muda o próprio perfil; o suporte não muda", async () => {
    const admin = await novaPessoa("admin");
    const suporte = await novaPessoa("suporte");
    const alvo = await novaPessoa();

    await alterarPapelNaPlataforma(db, admin, alvo.usuarioId, "suporte");
    await alterarPapelNaPlataforma(db, admin, alvo.usuarioId, "suporte"); // sem mudança: nada a registrar

    const [atualizado] = await db.select().from(usuarios).where(eq(usuarios.id, alvo.usuarioId));
    expect(atualizado?.papelPlataforma).toBe("suporte");
    const registros = await eventos("usuario.papel_alterado", alvo.usuarioId);
    expect(registros.map((evento) => evento.detalhes)).toEqual([
      { de: "cliente", para: "suporte" },
    ]);

    await alterarPapelNaPlataforma(db, admin, alvo.usuarioId, "cliente");
    const [rebaixado] = await db.select().from(usuarios).where(eq(usuarios.id, alvo.usuarioId));
    expect(rebaixado?.papelPlataforma).toBeNull();

    await expect(
      alterarPapelNaPlataforma(db, admin, admin.usuarioId, "cliente"),
    ).rejects.toBeInstanceOf(ErroConflito);
    await expect(
      alterarPapelNaPlataforma(db, suporte, alvo.usuarioId, "admin"),
    ).rejects.toBeInstanceOf(ErroProibido);
  });

  it("a plataforma nunca fica sem admin ativo (nem por duas alterações ao mesmo tempo)", async () => {
    // Cenário da corrida: quem age ainda é admin na sessão, mas outro admin já
    // o bloqueou no banco. Sobra um único admin ativo: ele não pode sair.
    await db
      .update(usuarios)
      .set({ bloqueadoEm: new Date() })
      .where(eq(usuarios.papelPlataforma, "admin"));
    const quemAge = await novaPessoa("admin");
    await db
      .update(usuarios)
      .set({ bloqueadoEm: new Date() })
      .where(eq(usuarios.id, quemAge.usuarioId));
    const ultimo = await novaPessoa("admin");

    await expect(
      alterarPapelNaPlataforma(db, quemAge, ultimo.usuarioId, "suporte"),
    ).rejects.toBeInstanceOf(ErroConflito);
    await expect(
      alterarBloqueioNaPlataforma(db, quemAge, ultimo.usuarioId, true),
    ).rejects.toBeInstanceOf(ErroConflito);

    // Com outro admin ativo, pode.
    const outro = await novaPessoa("admin");
    await alterarPapelNaPlataforma(db, outro, ultimo.usuarioId, "suporte");
    const [rebaixado] = await db.select().from(usuarios).where(eq(usuarios.id, ultimo.usuarioId));
    expect(rebaixado?.papelPlataforma).toBe("suporte");
  });
});
