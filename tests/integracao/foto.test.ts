import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { auditoria, usuarios } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import {
  ErroIndisponivel,
  ErroLimiteExcedido,
  ErroNaoEncontrado,
  ErroValidacao,
} from "@/lib/erros";
import { FOTO_TAMANHO_MAXIMO } from "@/lib/validacao/foto";
import type { ArmazenamentoDeFotos } from "@/server/armazenamento/fotos";
import type { Papel } from "@/server/auth/permissoes";
import { criarVinculo } from "@/server/repositories/usuarios";
import type { ContextoDoUsuario } from "@/server/services/contexto";
import {
  TROCAS_DE_FOTO_POR_HORA,
  alterarMinhaFoto,
  obterFotoDoUsuario,
  removerMinhaFoto,
} from "@/server/services/foto";

import { BYTES_DE_IMAGEM } from "../apoio/imagens";
import { criarBancoDeTeste, criarEmpresaDeTeste } from "./banco";

/** Serviço da foto com o banco real (PGlite) e o armazenamento em memória. */

let db: BancoDeDados;
let encerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, encerrar } = await criarBancoDeTeste());
});

afterAll(async () => {
  await encerrar();
});

/** Armazenamento em memória: registra o que foi gravado e apagado. */
function armazenamentoEmMemoria(disponivel = true) {
  const arquivos = new Map<string, Uint8Array>();
  const armazenamento: ArmazenamentoDeFotos = {
    disponivel,
    salvar: vi.fn(async (caminho: string, bytes: Uint8Array) => {
      arquivos.set(caminho, bytes);
    }),
    ler: vi.fn(async (caminho: string) => {
      const bytes = arquivos.get(caminho);
      return bytes
        ? { conteudo: new Blob([new Uint8Array(bytes)]).stream(), tamanho: bytes.length }
        : null;
    }),
    remover: vi.fn(async (caminho: string) => {
      arquivos.delete(caminho);
    }),
  };
  return { armazenamento, arquivos };
}

let sequencia = 0;

async function novoUsuario(papel: Papel = "cliente", empresaIds: string[] = []) {
  sequencia += 1;
  const [usuario] = await db
    .insert(usuarios)
    .values({
      nome: `Pessoa ${sequencia}`,
      email: `foto${sequencia}@teste.example`,
      papelPlataforma: papel === "cliente" ? null : papel,
    })
    .returning();
  if (!usuario) {
    throw new Error("usuário não criado");
  }
  for (const empresaId of empresaIds) {
    await criarVinculo(db, usuario.id, empresaId);
  }
  const contexto: ContextoDoUsuario = { usuarioId: usuario.id, ator: { papel, empresaIds } };
  return contexto;
}

async function caminhoGravado(usuarioId: string) {
  const [linha] = await db
    .select({ imagemUrl: usuarios.imagemUrl })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId));
  return linha?.imagemUrl ?? null;
}

async function acoesAuditadas(usuarioId: string) {
  return db
    .select({ acao: auditoria.acao, detalhes: auditoria.detalhes })
    .from(auditoria)
    .where(eq(auditoria.atorId, usuarioId));
}

describe("alterarMinhaFoto", () => {
  it("grava na pasta do usuário, aponta o banco para o arquivo e audita sem dados pessoais", async () => {
    const eu = await novoUsuario();
    const { armazenamento, arquivos } = armazenamentoEmMemoria();

    await alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.png);

    const caminho = await caminhoGravado(eu.usuarioId);
    expect(caminho).toMatch(new RegExp(`^local/usuarios/${eu.usuarioId}/[0-9a-f-]{36}\\.png$`));
    expect([...arquivos.keys()]).toEqual([caminho]);
    expect(await acoesAuditadas(eu.usuarioId)).toEqual([
      { acao: "usuario.foto_alterada", detalhes: { tipo: "image/png", bytes: 12 } },
    ]);
  });

  it("a extensão segue o tipo real dos bytes, não o nome do arquivo enviado", async () => {
    const eu = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria();

    await alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.webp);

    expect(await caminhoGravado(eu.usuarioId)).toMatch(/\.webp$/);
  });

  it("ao trocar, apaga o arquivo anterior", async () => {
    const eu = await novoUsuario();
    const { armazenamento, arquivos } = armazenamentoEmMemoria();

    await alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.png);
    const primeira = await caminhoGravado(eu.usuarioId);
    await alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.jpeg);
    const segunda = await caminhoGravado(eu.usuarioId);

    expect(segunda).not.toBe(primeira);
    expect([...arquivos.keys()]).toEqual([segunda]);
  });

  it("recusa arquivo que não é imagem, sem gravar nada", async () => {
    const eu = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria();
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");

    await expect(alterarMinhaFoto(db, armazenamento, eu, html)).rejects.toMatchObject({
      codigo: "VALIDACAO",
      detalhes: [{ campo: "foto", mensagem: "Use uma imagem JPEG, PNG ou WebP." }],
    });
    expect(armazenamento.salvar).not.toHaveBeenCalled();
    expect(await caminhoGravado(eu.usuarioId)).toBeNull();
  });

  it("recusa foto acima de 2 MB", async () => {
    const eu = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria();
    const grande = new Uint8Array(FOTO_TAMANHO_MAXIMO + 1);
    grande.set(BYTES_DE_IMAGEM.jpeg);

    await expect(alterarMinhaFoto(db, armazenamento, eu, grande)).rejects.toBeInstanceOf(
      ErroValidacao,
    );
    expect(armazenamento.salvar).not.toHaveBeenCalled();
  });

  it("sem armazenamento configurado, responde indisponível", async () => {
    const eu = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria(false);

    await expect(
      alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.png),
    ).rejects.toBeInstanceOf(ErroIndisponivel);
  });

  it("se o banco falhar, apaga o arquivo novo (nada fica órfão)", async () => {
    const eu = await novoUsuario();
    const { armazenamento, arquivos } = armazenamentoEmMemoria();
    // Usuário excluído no meio do caminho: o banco não encontra a linha.
    await db.update(usuarios).set({ deletedAt: new Date() }).where(eq(usuarios.id, eu.usuarioId));

    await expect(
      alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.png),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
    expect(armazenamento.salvar).toHaveBeenCalledOnce();
    expect(arquivos.size).toBe(0);
  });

  it("falha ao apagar o arquivo antigo não desfaz a troca", async () => {
    const eu = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria();
    await alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.png);
    vi.mocked(armazenamento.remover).mockRejectedValueOnce(new Error("Blob fora do ar"));
    const erroNoLog = vi.spyOn(console, "error").mockImplementation(() => {});

    await alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.jpeg);

    expect(await caminhoGravado(eu.usuarioId)).toMatch(/\.jpg$/);
    expect(erroNoLog).toHaveBeenCalledOnce();
    erroNoLog.mockRestore();
  });

  it("nunca apaga um arquivo fora da pasta do próprio usuário", async () => {
    const eu = await novoUsuario();
    const outro = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria();
    const caminhoDoOutro = `local/usuarios/${outro.usuarioId}/0199a000-0000-7000-8000-00000000abcd.png`;
    await db
      .update(usuarios)
      .set({ imagemUrl: caminhoDoOutro })
      .where(eq(usuarios.id, eu.usuarioId));

    await alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.png);

    expect(armazenamento.remover).not.toHaveBeenCalled();
  });

  it(`limita a ${TROCAS_DE_FOTO_POR_HORA} trocas por hora`, async () => {
    const eu = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria();
    for (let troca = 0; troca < TROCAS_DE_FOTO_POR_HORA; troca += 1) {
      await alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.png);
    }

    await expect(
      alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.png),
    ).rejects.toBeInstanceOf(ErroLimiteExcedido);
    expect(armazenamento.salvar).toHaveBeenCalledTimes(TROCAS_DE_FOTO_POR_HORA);
  });
});

describe("removerMinhaFoto", () => {
  it("limpa o perfil, apaga o arquivo e audita", async () => {
    const eu = await novoUsuario();
    const { armazenamento, arquivos } = armazenamentoEmMemoria();
    await alterarMinhaFoto(db, armazenamento, eu, BYTES_DE_IMAGEM.png);

    await removerMinhaFoto(db, armazenamento, eu);

    expect(await caminhoGravado(eu.usuarioId)).toBeNull();
    expect(arquivos.size).toBe(0);
    expect((await acoesAuditadas(eu.usuarioId)).map((evento) => evento.acao)).toContain(
      "usuario.foto_removida",
    );
  });

  it("sem foto, não faz nada nem audita", async () => {
    const eu = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria();

    await removerMinhaFoto(db, armazenamento, eu);

    expect(armazenamento.remover).not.toHaveBeenCalled();
    expect(await acoesAuditadas(eu.usuarioId)).toEqual([]);
  });
});

describe("obterFotoDoUsuario (quem pode ver)", () => {
  async function pessoaComFoto(empresaIds: string[] = []) {
    const pessoa = await novoUsuario("cliente", empresaIds);
    const { armazenamento } = armazenamentoEmMemoria();
    await alterarMinhaFoto(db, armazenamento, pessoa, BYTES_DE_IMAGEM.webp);
    return { pessoa, armazenamento };
  }

  it("a própria pessoa vê a foto, com o tipo definido pelo app", async () => {
    const { pessoa, armazenamento } = await pessoaComFoto();

    const foto = await obterFotoDoUsuario(db, armazenamento, pessoa, pessoa.usuarioId);

    expect(foto).toMatchObject({ tipo: "image/webp", tamanho: BYTES_DE_IMAGEM.webp.length });
  });

  it("colega de uma empresa em comum vê a foto", async () => {
    const empresa = await criarEmpresaDeTeste(db);
    const { pessoa, armazenamento } = await pessoaComFoto([empresa.id]);
    const colega = await novoUsuario("cliente", [empresa.id]);

    await expect(
      obterFotoDoUsuario(db, armazenamento, colega, pessoa.usuarioId),
    ).resolves.toMatchObject({ tipo: "image/webp" });
  });

  it("cliente de outra empresa recebe 404 (IDOR)", async () => {
    const [empresaA, empresaB] = [await criarEmpresaDeTeste(db), await criarEmpresaDeTeste(db)];
    const { pessoa, armazenamento } = await pessoaComFoto([empresaA.id]);
    const estranho = await novoUsuario("cliente", [empresaB.id]);

    await expect(
      obterFotoDoUsuario(db, armazenamento, estranho, pessoa.usuarioId),
    ).rejects.toBeInstanceOf(ErroNaoEncontrado);
    expect(armazenamento.ler).not.toHaveBeenCalled();
  });

  it("o suporte vê a foto de qualquer usuário", async () => {
    const { pessoa, armazenamento } = await pessoaComFoto();
    const suporte = await novoUsuario("suporte");

    await expect(
      obterFotoDoUsuario(db, armazenamento, suporte, pessoa.usuarioId),
    ).resolves.toMatchObject({ tipo: "image/webp" });
  });

  it("usuário inexistente, ID inválido ou sem foto: 404", async () => {
    const eu = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria();

    for (const id of ["0199a000-0000-7000-8000-00000000ffff", "../../etc/passwd", eu.usuarioId]) {
      await expect(obterFotoDoUsuario(db, armazenamento, eu, id)).rejects.toBeInstanceOf(
        ErroNaoEncontrado,
      );
    }
  });

  it("caminho fora do formato no banco (ex.: URL externa) nunca é lido", async () => {
    const eu = await novoUsuario();
    const { armazenamento } = armazenamentoEmMemoria();
    await db
      .update(usuarios)
      .set({ imagemUrl: "https://site-falso.example/rastreador.png" })
      .where(eq(usuarios.id, eu.usuarioId));

    await expect(obterFotoDoUsuario(db, armazenamento, eu, eu.usuarioId)).rejects.toBeInstanceOf(
      ErroNaoEncontrado,
    );
    expect(armazenamento.ler).not.toHaveBeenCalled();
  });
});
