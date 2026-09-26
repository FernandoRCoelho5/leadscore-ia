import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { auditoria, sessoes, usuarios, verificacoes } from "@/db/schema";
import { auth } from "@/server/auth/auth";
import { enviarEmail } from "@/server/email/enviador";

/**
 * A configuração do Better Auth (src/server/auth/auth.ts) contra um Postgres de
 * verdade (PGlite). As requisições passam pelo mesmo handler das rotas
 * /api/auth/*, então valem os nossos hooks: revalidação do cadastro, bloqueio,
 * auditoria e as rotas desligadas.
 */

// O banco precisa existir antes de auth.ts ser importado (ele lê `db` ao carregar).
const banco = await vi.hoisted(async () => {
  const { criarBancoDeTeste } = await import("./banco");
  return criarBancoDeTeste();
});

vi.mock("@/db", () => ({ db: banco.db }));
vi.mock("@/server/email/enviador", () => ({ enviarEmail: vi.fn() }));

const ORIGEM = "http://localhost:3000";
const SENHA = "senha-de-teste-123";

afterAll(async () => {
  await banco.encerrar();
});

beforeEach(() => {
  vi.mocked(enviarEmail).mockClear();
});

/** Chama uma rota /api/auth/* como o navegador faria (POST com JSON). */
async function chamar(caminho: string, corpo: unknown = {}, cookie?: string): Promise<Response> {
  const headers = new Headers({ origin: ORIGEM, "content-type": "application/json" });
  if (cookie) {
    headers.set("cookie", cookie);
  }
  return auth.handler(
    new Request(`${ORIGEM}/api/auth${caminho}`, {
      method: "POST",
      headers,
      body: JSON.stringify(corpo),
    }),
  );
}

/** Transforma os Set-Cookie da resposta no cabeçalho Cookie da próxima requisição. */
function cookieDe(resposta: Response): string {
  return resposta.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

let sequencia = 0;

async function cadastrar(nome = "Pessoa de Teste") {
  sequencia += 1;
  const email = `pessoa${sequencia}@teste.example`;
  const resposta = await chamar("/sign-up/email", { name: nome, email, password: SENHA });
  expect(resposta.status).toBe(200);
  const [usuario] = await banco.db.select().from(usuarios).where(eq(usuarios.email, email));
  if (!usuario) {
    throw new Error("usuário não criado");
  }
  return { usuario, email, cookie: cookieDe(resposta) };
}

async function acoesAuditadas(usuarioId: string): Promise<string[]> {
  const eventos = await banco.db
    .select({ acao: auditoria.acao })
    .from(auditoria)
    .where(eq(auditoria.atorId, usuarioId));
  return eventos.map((evento) => evento.acao);
}

describe("cadastro", () => {
  it("normaliza nome e e-mail, descarta a foto enviada e registra a auditoria", async () => {
    const resposta = await chamar("/sign-up/email", {
      name: "  Ana Souza  ",
      email: "Ana.Souza@Teste.Example",
      password: SENHA,
      // A foto só entra pelo fluxo de upload; uma URL enviada aqui é descartada.
      image: "https://site-falso.example/rastreador.png",
    });

    expect(resposta.status).toBe(200);
    const [usuario] = await banco.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, "ana.souza@teste.example"));
    expect(usuario).toMatchObject({ nome: "Ana Souza", imagemUrl: null, papelPlataforma: null });
    // Com o login automático, o cadastro já abre a primeira sessão.
    expect(await acoesAuditadas(usuario?.id ?? "")).toEqual(
      expect.arrayContaining(["usuario.cadastrado", "auth.login"]),
    );
  });

  it("revalida o nome quando a API é chamada sem o formulário", async () => {
    const resposta = await chamar("/sign-up/email", {
      name: " A ",
      email: "nome-curto@teste.example",
      password: SENHA,
    });

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toMatchObject({ code: "DADOS_INVALIDOS" });
    const criados = await banco.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, "nome-curto@teste.example"));
    expect(criados).toEqual([]);
  });

  it("recusa senha menor que o mínimo", async () => {
    const resposta = await chamar("/sign-up/email", {
      name: "Senha Curta",
      email: "senha-curta@teste.example",
      password: "curta",
    });

    expect(resposta.status).toBe(400);
  });
});

describe("login", () => {
  it("guarda a senha só como hash", async () => {
    const { email } = await cadastrar();
    const resposta = await chamar("/sign-in/email", { email, password: SENHA });

    expect(resposta.status).toBe(200);
    const tabelaContas = await banco.db.query.contas.findMany();
    expect(tabelaContas.every((conta) => conta.senha !== SENHA)).toBe(true);
  });

  it("recusa senha errada sem dizer qual dado está incorreto", async () => {
    const { email } = await cadastrar();
    const resposta = await chamar("/sign-in/email", { email, password: "senha-errada-123" });

    expect(resposta.status).toBe(401);
    expect(await resposta.json()).toMatchObject({ code: "INVALID_EMAIL_OR_PASSWORD" });
  });

  it("não abre sessão para usuário bloqueado", async () => {
    const { usuario, email } = await cadastrar();
    await banco.db
      .update(usuarios)
      .set({ bloqueadoEm: new Date() })
      .where(eq(usuarios.id, usuario.id));

    const resposta = await chamar("/sign-in/email", { email, password: SENHA });

    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toMatchObject({ code: "CONTA_BLOQUEADA" });
  });

  it("não abre sessão para usuário excluído (exclusão lógica)", async () => {
    const { usuario, email } = await cadastrar();
    await banco.db
      .update(usuarios)
      .set({ deletedAt: new Date() })
      .where(eq(usuarios.id, usuario.id));

    const resposta = await chamar("/sign-in/email", { email, password: SENHA });

    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toMatchObject({ code: "CONTA_BLOQUEADA" });
  });
});

describe("sessão e senha", () => {
  it("sair apaga a sessão e registra a auditoria", async () => {
    const { usuario, cookie } = await cadastrar();
    expect(
      await banco.db.select().from(sessoes).where(eq(sessoes.usuarioId, usuario.id)),
    ).toHaveLength(1);

    const resposta = await chamar("/sign-out", {}, cookie);

    expect(resposta.status).toBe(200);
    // Exceção D-006: sessões são apagadas de verdade (dado temporário).
    expect(await banco.db.select().from(sessoes).where(eq(sessoes.usuarioId, usuario.id))).toEqual(
      [],
    );
    expect(await acoesAuditadas(usuario.id)).toContain("auth.sessao_encerrada");
  });

  it("troca de senha exige a senha atual e registra a auditoria", async () => {
    const { usuario, email, cookie } = await cadastrar();
    const novaSenha = "outra-senha-forte-456";

    const errada = await chamar(
      "/change-password",
      { currentPassword: "nao-e-a-senha", newPassword: novaSenha },
      cookie,
    );
    expect(errada.status).toBe(400);

    const certa = await chamar(
      "/change-password",
      { currentPassword: SENHA, newPassword: novaSenha, revokeOtherSessions: true },
      cookie,
    );
    expect(certa.status).toBe(200);
    expect(await acoesAuditadas(usuario.id)).toContain("usuario.senha_alterada");

    const login = await chamar("/sign-in/email", { email, password: novaSenha });
    expect(login.status).toBe(200);
  });

  it("rotas desligadas não existem (perfil e exclusão passam pelos nossos serviços)", async () => {
    const { cookie } = await cadastrar();

    for (const caminho of ["/update-user", "/delete-user", "/change-email"]) {
      const resposta = await chamar(caminho, { name: "Outro Nome" }, cookie);
      expect(resposta.status, caminho).toBe(404);
    }
  });
});

describe("redefinição de senha", () => {
  it("envia o link, guarda só o hash do token e encerra as sessões antigas", async () => {
    const { usuario, email } = await cadastrar();

    const pedido = await chamar("/request-password-reset", {
      email,
      redirectTo: "/redefinir-senha",
    });

    expect(pedido.status).toBe(200);
    expect(enviarEmail).toHaveBeenCalledOnce();
    const mensagem = vi.mocked(enviarEmail).mock.calls[0]?.[0];
    expect(mensagem?.para).toBe(email);
    const token = /\/reset-password\/([^?\s]+)/.exec(mensagem?.texto ?? "")?.[1];
    expect(token).toBeTruthy();

    // O banco não guarda o token em texto: quem lê a tabela não consegue usá-lo.
    const registros = await banco.db.select().from(verificacoes);
    expect(registros.some((registro) => registro.identificador.includes(token ?? ""))).toBe(false);

    const redefinicao = await chamar("/reset-password", {
      token,
      newPassword: "senha-redefinida-789",
    });
    expect(redefinicao.status).toBe(200);
    expect(await banco.db.select().from(sessoes).where(eq(sessoes.usuarioId, usuario.id))).toEqual(
      [],
    );

    // O token só vale uma vez.
    const repetida = await chamar("/reset-password", { token, newPassword: "mais-uma-senha-000" });
    expect(repetida.status).toBe(400);
  });

  it("responde igual para e-mail inexistente, sem enviar nada", async () => {
    const pedido = await chamar("/request-password-reset", {
      email: "ninguem@teste.example",
      redirectTo: "/redefinir-senha",
    });

    expect(pedido.status).toBe(200);
    expect(enviarEmail).not.toHaveBeenCalled();
  });
});
