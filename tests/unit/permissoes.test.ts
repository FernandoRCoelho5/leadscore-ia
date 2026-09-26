import { describe, expect, it } from "vitest";

import { ErroNaoEncontrado, ErroProibido } from "@/lib/erros";
import {
  ACOES,
  PAPEIS,
  autorizar,
  pode,
  podeVerPerfil,
  type Acao,
  type Ator,
  type Papel,
} from "@/server/auth/permissoes";

/**
 * Matriz RBAC aprovada (docs/arquitetura.md, seção 4), escrita de novo aqui de
 * propósito: se alguém mudar uma permissão no código sem mudar a especificação,
 * o teste falha.
 */
const ESPERADO: Record<Acao, Record<Papel, boolean>> = {
  "painel:ver": { admin: true, suporte: true, cliente: true },
  "leads:ver": { admin: true, suporte: true, cliente: true },
  "leads:editar": { admin: true, suporte: false, cliente: true },
  "leads:exportar": { admin: true, suporte: false, cliente: true },
  "empresa:ver": { admin: true, suporte: true, cliente: true },
  "empresa:editar": { admin: true, suporte: false, cliente: true },
  "empresa:administrar": { admin: true, suporte: false, cliente: false },
  "empresas:listar": { admin: true, suporte: true, cliente: false },
  "usuarios:listar": { admin: true, suporte: true, cliente: false },
  "membros:ver": { admin: true, suporte: true, cliente: true },
  "membros:gerir": { admin: true, suporte: false, cliente: true },
  "plataforma:gerir-usuarios": { admin: true, suporte: false, cliente: false },
  "auditoria:ver": { admin: true, suporte: true, cliente: false },
  "perfil:editar": { admin: true, suporte: true, cliente: true },
};

const EMPRESA_DO_CLIENTE = "11111111-1111-4111-8111-111111111111";
const OUTRA_EMPRESA = "22222222-2222-4222-8222-222222222222";

const ator = (papel: Papel): Ator => ({
  papel,
  empresaIds: papel === "cliente" ? [EMPRESA_DO_CLIENTE] : [],
});

describe("matriz de permissões", () => {
  it("a especificação cobre todas as ações do código", () => {
    expect(Object.keys(ESPERADO).sort()).toEqual([...ACOES].sort());
  });

  const casos = ACOES.flatMap((acao) =>
    PAPEIS.map((papel) => [papel, acao, ESPERADO[acao][papel]] as const),
  );

  it.each(casos)("%s em %s: %s", (papel, acao, permitido) => {
    expect(pode(ator(papel), acao)).toBe(permitido);
  });

  it("o suporte não escreve nada nos dados de clientes (só edita o próprio perfil)", () => {
    const escritas = ACOES.filter(
      (acao) => /editar|exportar|gerir|administrar/.test(acao) && acao !== "perfil:editar",
    );
    for (const acao of escritas) {
      expect(pode(ator("suporte"), acao), acao).toBe(false);
    }
  });
});

describe("escopo de empresa", () => {
  it("o cliente só atua nas empresas das quais é membro", () => {
    expect(pode(ator("cliente"), "leads:ver", EMPRESA_DO_CLIENTE)).toBe(true);
    expect(pode(ator("cliente"), "leads:ver", OUTRA_EMPRESA)).toBe(false);
  });

  it("admin e suporte atuam em qualquer empresa (dentro das suas permissões)", () => {
    expect(pode(ator("admin"), "leads:editar", OUTRA_EMPRESA)).toBe(true);
    expect(pode(ator("suporte"), "leads:ver", OUTRA_EMPRESA)).toBe(true);
    expect(pode(ator("suporte"), "leads:editar", OUTRA_EMPRESA)).toBe(false);
  });
});

describe("autorizar", () => {
  it("ação sem permissão lança 'proibido' (403)", () => {
    expect(() => autorizar(ator("suporte"), "empresa:editar")).toThrow(ErroProibido);
  });

  it("empresa de outro cliente responde 'não encontrado' (404), sem revelar que existe", () => {
    expect(() => autorizar(ator("cliente"), "empresa:editar", OUTRA_EMPRESA)).toThrow(
      ErroNaoEncontrado,
    );
  });

  it("não lança quando permitido", () => {
    expect(() => autorizar(ator("cliente"), "empresa:editar", EMPRESA_DO_CLIENTE)).not.toThrow();
  });
});

describe("podeVerPerfil (nome e foto de outra pessoa)", () => {
  const EU = "0199a000-0000-7000-8000-000000000001";
  const COLEGA = { id: "0199a000-0000-7000-8000-000000000002", empresaIds: ["empresa-a"] };
  const ESTRANHO = { id: "0199a000-0000-7000-8000-000000000003", empresaIds: ["empresa-b"] };
  const cliente: Ator = { papel: "cliente", empresaIds: ["empresa-a"] };

  it("todos veem o próprio perfil", () => {
    for (const papel of PAPEIS) {
      expect(podeVerPerfil({ papel, empresaIds: [] }, EU, { id: EU, empresaIds: [] })).toBe(true);
    }
  });

  it("cliente vê quem é membro de uma empresa em comum", () => {
    expect(podeVerPerfil(cliente, EU, COLEGA)).toBe(true);
  });

  it("cliente não vê usuários de outras empresas", () => {
    expect(podeVerPerfil(cliente, EU, ESTRANHO)).toBe(false);
    expect(podeVerPerfil(cliente, EU, { id: ESTRANHO.id, empresaIds: [] })).toBe(false);
  });

  it("admin e suporte (equipe do SaaS) veem qualquer usuário", () => {
    expect(podeVerPerfil({ papel: "admin", empresaIds: [] }, EU, ESTRANHO)).toBe(true);
    expect(podeVerPerfil({ papel: "suporte", empresaIds: [] }, EU, ESTRANHO)).toBe(true);
  });
});
