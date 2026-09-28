import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Usuario } from "@/db/schema";
import {
  COOKIE_EMPRESA_ATIVA,
  contextoDa,
  exigirPermissao,
  exigirSessao,
  exigirSessaoComEmpresa,
  obterSessao,
} from "@/server/auth/sessao";
import { listarEmpresasDoUsuario, obterUsuarioAtivo } from "@/server/repositories/usuarios";

/**
 * Sessão do servidor (src/server/auth/sessao.ts) com o Next.js, o Better Auth e
 * o banco simulados: aqui se testa a regra (quem entra, qual empresa fica ativa,
 * para onde vai quem não pode), não a biblioteca.
 */

const simulado = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ user: { id: string } } | null>>(),
  cookies: new Map<string, string>(),
}));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/auth/auth", () => ({ auth: { api: { getSession: simulado.getSession } } }));
vi.mock("@/server/repositories/usuarios", () => ({
  obterUsuarioAtivo: vi.fn(),
  listarEmpresasDoUsuario: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (nome: string) => {
      const value = simulado.cookies.get(nome);
      return value === undefined ? undefined : { name: nome, value };
    },
  }),
}));
// redirect() e notFound() interrompem a renderização lançando um erro; aqui também.
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect:${destino}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

const EMPRESA_A = { empresaId: "0199a000-0000-7000-8000-00000000000a", nome: "A", slug: "a" };
const EMPRESA_B = { empresaId: "0199a000-0000-7000-8000-00000000000b", nome: "B", slug: "b" };

function usuario(dados: Partial<Usuario> = {}): Usuario {
  const agora = new Date();
  return {
    id: "0199a000-0000-7000-8000-000000000001",
    nome: "Pessoa",
    email: "pessoa@teste.example",
    emailVerificado: false,
    imagemUrl: null,
    papelPlataforma: null,
    bloqueadoEm: null,
    createdAt: agora,
    updatedAt: agora,
    deletedAt: null,
    ...dados,
  };
}

function logado(dados: Partial<Usuario> = {}, vinculos = [EMPRESA_A]) {
  const u = usuario(dados);
  simulado.getSession.mockResolvedValue({ user: { id: u.id } });
  vi.mocked(obterUsuarioAtivo).mockResolvedValue(u);
  vi.mocked(listarEmpresasDoUsuario).mockResolvedValue(vinculos);
}

beforeEach(() => {
  vi.clearAllMocks();
  simulado.getSession.mockResolvedValue(null);
  simulado.cookies.clear();
});

describe("obterSessao", () => {
  it("sem cookie de sessão válido, não há sessão (e o banco nem é consultado)", async () => {
    expect(await obterSessao()).toBeNull();
    expect(obterUsuarioAtivo).not.toHaveBeenCalled();
  });

  it("usuário excluído perde a sessão na hora", async () => {
    logado();
    vi.mocked(obterUsuarioAtivo).mockResolvedValue(undefined);

    expect(await obterSessao()).toBeNull();
  });

  it("usuário bloqueado perde a sessão na hora", async () => {
    logado({ bloqueadoEm: new Date() });

    expect(await obterSessao()).toBeNull();
  });

  it("cliente: a empresa ativa é a primeira, sem preferência salva", async () => {
    logado({}, [EMPRESA_A, EMPRESA_B]);

    const sessao = await obterSessao();

    expect(sessao).toMatchObject({
      papel: "cliente",
      empresaAtiva: EMPRESA_A,
      ator: { papel: "cliente", empresaIds: [EMPRESA_A.empresaId, EMPRESA_B.empresaId] },
    });
  });

  it("cliente: respeita a empresa escolhida quando ele é membro dela", async () => {
    logado({}, [EMPRESA_A, EMPRESA_B]);
    simulado.cookies.set(COOKIE_EMPRESA_ATIVA, EMPRESA_B.empresaId);

    expect((await obterSessao())?.empresaAtiva).toEqual(EMPRESA_B);
  });

  it("cliente: ignora cookie com empresa da qual não é membro (IDOR)", async () => {
    logado({}, [EMPRESA_A]);
    simulado.cookies.set(COOKIE_EMPRESA_ATIVA, EMPRESA_B.empresaId);

    const sessao = await obterSessao();

    expect(sessao?.empresaAtiva).toEqual(EMPRESA_A);
    expect(sessao?.ator.empresaIds).toEqual([EMPRESA_A.empresaId]);
  });

  it("expõe o endereço da rota da foto, nunca o caminho no armazenamento", async () => {
    const id = "0199a000-0000-7000-8000-000000000001";
    const versao = "0199a000-0000-7000-8000-00000000abcd";
    logado({ imagemUrl: `local/usuarios/${id}/${versao}.webp` });

    const sessao = await obterSessao();

    expect(sessao?.usuario.fotoUrl).toBe(`/api/usuarios/${id}/foto?v=${versao}`);
    expect(JSON.stringify(sessao)).not.toContain("local/usuarios");
  });

  it("sem foto (ou com valor fora do formato), fotoUrl é nula", async () => {
    logado({ imagemUrl: "https://site-falso.example/foto.png" });

    expect((await obterSessao())?.usuario.fotoUrl).toBeNull();
  });

  it("admin sem vínculo fica sem empresa ativa", async () => {
    logado({ papelPlataforma: "admin" }, []);

    expect(await obterSessao()).toMatchObject({ papel: "admin", empresaAtiva: null });
  });
});

describe("exigirSessao e exigirSessaoComEmpresa", () => {
  it("sem sessão, manda para o login", async () => {
    await expect(exigirSessao()).rejects.toThrow("redirect:/login");
  });

  it("cliente recém-cadastrado, sem empresa, vai para o onboarding", async () => {
    logado({}, []);

    await expect(exigirSessaoComEmpresa()).rejects.toThrow("redirect:/onboarding");
  });

  it("suporte não precisa de empresa", async () => {
    logado({ papelPlataforma: "suporte" }, []);

    await expect(exigirSessaoComEmpresa()).resolves.toMatchObject({ papel: "suporte" });
  });
});

describe("exigirPermissao", () => {
  it("sem permissão, responde 404 (não revela que a página existe)", async () => {
    logado({ papelPlataforma: "suporte" }, []);

    await expect(exigirPermissao("leads:editar")).rejects.toThrow("notFound");
  });

  it("cliente não entra na administração", async () => {
    logado();

    await expect(exigirPermissao("empresas:listar")).rejects.toThrow("notFound");
  });

  it("com permissão, devolve a sessão", async () => {
    logado();

    await expect(exigirPermissao("leads:editar")).resolves.toMatchObject({ papel: "cliente" });
  });
});

describe("contextoDa", () => {
  it("passa aos serviços só o ID do usuário e o ator", async () => {
    logado();
    const sessao = await exigirSessao();

    expect(contextoDa(sessao)).toEqual({
      usuarioId: "0199a000-0000-7000-8000-000000000001",
      ator: { papel: "cliente", empresaIds: [EMPRESA_A.empresaId] },
    });
  });
});
