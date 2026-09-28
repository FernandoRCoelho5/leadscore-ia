import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditoria, empresas, membrosEmpresa, usuarios } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { ErroConflito, ErroNaoEncontrado, ErroProibido, ErroValidacao } from "@/lib/erros";
import type { DadosDoOnboarding } from "@/lib/validacao/empresa";
import type { Papel } from "@/server/auth/permissoes";
import { listarEmpresasDoUsuario } from "@/server/repositories/usuarios";
import type { ContextoDoUsuario } from "@/server/services/contexto";
import { atualizarPerfilDoNegocio, criarEmpresaNoOnboarding } from "@/server/services/empresas";
import { atualizarMeuNome } from "@/server/services/perfil";

import { criarBancoDeTeste } from "./banco";

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
});

afterAll(async () => {
  await encerrar();
});

let sequencia = 0;

async function novoUsuario(papel: Papel = "cliente"): Promise<ContextoDoUsuario> {
  sequencia += 1;
  const [usuario] = await db
    .insert(usuarios)
    .values({
      nome: `Pessoa ${sequencia}`,
      email: `pessoa${sequencia}@teste.example`,
      papelPlataforma: papel === "cliente" ? null : papel,
    })
    .returning();
  if (!usuario) {
    throw new Error("usuário não criado");
  }
  return { usuarioId: usuario.id, ator: { papel, empresaIds: [] } };
}

function dadosDeOnboarding(slug: string): DadosDoOnboarding {
  return {
    nomeEmpresa: "Empresa de Teste",
    slug,
    descricao: "Fabricamos peças sob medida para a indústria.",
    produtosServicos: null,
    clienteIdeal: "Indústrias de médio porte do Sul Fluminense.",
    ticketMedioReais: 4500,
    regioesAtendidas: null,
  };
}

async function clienteComEmpresa() {
  const contexto = await novoUsuario();
  sequencia += 1;
  const empresa = await criarEmpresaNoOnboarding(db, contexto, dadosDeOnboarding(`e-${sequencia}`));
  return {
    contexto: { ...contexto, ator: { papel: "cliente" as const, empresaIds: [empresa.id] } },
    empresa,
  };
}

describe("onboarding", () => {
  it("cria a empresa, o vínculo do cliente e o registro de auditoria", async () => {
    const contexto = await novoUsuario();

    const empresa = await criarEmpresaNoOnboarding(db, contexto, dadosDeOnboarding("pecas-ok"));

    expect(empresa).toMatchObject({
      slug: "pecas-ok",
      ticketMedioCentavos: 450_000,
      perfilVersao: 1,
    });
    expect(await listarEmpresasDoUsuario(db, contexto.usuarioId)).toEqual([
      { empresaId: empresa.id, nome: "Empresa de Teste", slug: "pecas-ok" },
    ]);
    const eventos = await db
      .select({ acao: auditoria.acao })
      .from(auditoria)
      .where(eq(auditoria.empresaId, empresa.id));
    expect(eventos).toEqual([{ acao: "empresa.criada" }]);
  });

  it("endereço já usado vira erro no campo 'slug'", async () => {
    await criarEmpresaNoOnboarding(db, await novoUsuario(), dadosDeOnboarding("repetido"));

    const tentativa = criarEmpresaNoOnboarding(
      db,
      await novoUsuario(),
      dadosDeOnboarding("repetido"),
    );

    await expect(tentativa).rejects.toThrow(ErroValidacao);
    await expect(tentativa).rejects.toMatchObject({ detalhes: [{ campo: "slug" }] });
  });

  it("quem já tem empresa não passa de novo pelo onboarding", async () => {
    const { contexto } = await clienteComEmpresa();

    await expect(
      criarEmpresaNoOnboarding(db, contexto, dadosDeOnboarding("segunda")),
    ).rejects.toThrow(ErroConflito);
  });

  it("contas da equipe Brasa não criam empresas pelo onboarding", async () => {
    await expect(
      criarEmpresaNoOnboarding(db, await novoUsuario("admin"), dadosDeOnboarding("da-equipe")),
    ).rejects.toThrow(ErroProibido);
  });
});

describe("perfil do negócio", () => {
  const novoPerfil = {
    descricao: "Nova descrição do negócio, mais detalhada.",
    produtosServicos: "Peças e manutenção",
    clienteIdeal: "Indústrias e distribuidoras de todo o estado.",
    ticketMedioReais: 9000,
    regioesAtendidas: "Rio de Janeiro",
  };

  it("o cliente atualiza o próprio perfil e a versão do perfil sobe", async () => {
    const { contexto, empresa } = await clienteComEmpresa();

    const atualizada = await atualizarPerfilDoNegocio(db, contexto, empresa.id, novoPerfil);

    expect(atualizada).toMatchObject({ perfilVersao: 2, ticketMedioCentavos: 900_000 });
    const [evento] = await db
      .select({ detalhes: auditoria.detalhes })
      .from(auditoria)
      .where(
        and(eq(auditoria.empresaId, empresa.id), eq(auditoria.acao, "empresa.perfil_atualizado")),
      );
    expect(evento?.detalhes).toEqual({ perfilVersao: 2 });
  });

  it("um cliente não altera a empresa de outro (e não descobre que ela existe)", async () => {
    const { empresa } = await clienteComEmpresa();
    const { contexto: intruso } = await clienteComEmpresa();

    await expect(atualizarPerfilDoNegocio(db, intruso, empresa.id, novoPerfil)).rejects.toThrow(
      ErroNaoEncontrado,
    );
    const [intacta] = await db.select().from(empresas).where(eq(empresas.id, empresa.id));
    expect(intacta?.perfilVersao).toBe(1);
  });

  it("o suporte só lê: não altera o perfil", async () => {
    const { empresa } = await clienteComEmpresa();

    await expect(
      atualizarPerfilDoNegocio(db, await novoUsuario("suporte"), empresa.id, novoPerfil),
    ).rejects.toThrow(ErroProibido);
  });

  it("o admin pode ajustar o perfil de qualquer empresa", async () => {
    const { empresa } = await clienteComEmpresa();

    const atualizada = await atualizarPerfilDoNegocio(
      db,
      await novoUsuario("admin"),
      empresa.id,
      novoPerfil,
    );

    expect(atualizada.perfilVersao).toBe(2);
  });
});

describe("meu perfil", () => {
  it("altera o nome e audita sem gravar o nome (dado pessoal)", async () => {
    const contexto = await novoUsuario();

    await atualizarMeuNome(db, contexto, "Nome Novo");

    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, contexto.usuarioId));
    expect(usuario?.nome).toBe("Nome Novo");
    const [evento] = await db
      .select({ detalhes: auditoria.detalhes })
      .from(auditoria)
      .where(eq(auditoria.atorId, contexto.usuarioId));
    expect(JSON.stringify(evento?.detalhes)).not.toContain("Nome Novo");
  });
});

describe("vínculos com empresas", () => {
  it("ignora vínculo excluído e empresa bloqueada", async () => {
    const { contexto, empresa } = await clienteComEmpresa();
    expect(await listarEmpresasDoUsuario(db, contexto.usuarioId)).toHaveLength(1);

    await db.update(empresas).set({ status: "bloqueada" }).where(eq(empresas.id, empresa.id));
    expect(await listarEmpresasDoUsuario(db, contexto.usuarioId)).toEqual([]);

    await db.update(empresas).set({ status: "ativa" }).where(eq(empresas.id, empresa.id));
    await db
      .update(membrosEmpresa)
      .set({ deletedAt: new Date() })
      .where(eq(membrosEmpresa.usuarioId, contexto.usuarioId));
    expect(await listarEmpresasDoUsuario(db, contexto.usuarioId)).toEqual([]);
  });
});
