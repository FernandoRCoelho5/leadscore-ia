import { del, get, put } from "@vercel/blob";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FOTO_TAMANHO_MAXIMO, tipoRealDaImagem, validarFoto } from "@/lib/validacao/foto";
import {
  armazenamentoNoBlob,
  enderecoDaFoto,
  lerCaminhoDeFoto,
  novoCaminhoDeFoto,
  pastaDasFotos,
} from "@/server/armazenamento/fotos";

import { BYTES_DE_IMAGEM } from "../apoio/imagens";

vi.mock("@vercel/blob", () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }));

const BYTES = BYTES_DE_IMAGEM;

const texto = (conteudo: string) => new TextEncoder().encode(conteudo);

const USUARIO = "0199a000-0000-7000-8000-000000000001";
const OUTRO = "0199a000-0000-7000-8000-000000000002";
const UUID = "0199a000-0000-7000-8000-00000000abcd";

describe("tipoRealDaImagem (assinatura dos bytes)", () => {
  it.each([
    ["JPEG", BYTES.jpeg, "image/jpeg"],
    ["PNG", BYTES.png, "image/png"],
    ["WebP", BYTES.webp, "image/webp"],
  ])("reconhece %s", (_nome, bytes, tipo) => {
    expect(tipoRealDaImagem(bytes)).toBe(tipo);
  });

  it.each([
    ["HTML com extensão .png", texto("<html><script>alert(1)</script>")],
    ["SVG (pode conter script)", texto('<svg xmlns="http://www.w3.org/2000/svg">')],
    ["GIF", texto("GIF89a......")],
    ["RIFF que não é WebP (áudio WAV)", texto("RIFF\x24\x00\x00\x00WAVEfmt ")],
    ["PNG truncado", BYTES.png.subarray(0, 4)],
    ["arquivo vazio", new Uint8Array()],
  ])("recusa %s", (_nome, bytes) => {
    expect(tipoRealDaImagem(bytes)).toBeNull();
  });
});

describe("validarFoto", () => {
  it("aceita imagem dentro do limite", () => {
    expect(validarFoto(BYTES.png)).toEqual({ ok: true, tipo: "image/png" });
  });

  it("recusa arquivo vazio", () => {
    expect(validarFoto(new Uint8Array())).toEqual({ ok: false, problema: "vazia" });
  });

  it("recusa acima de 2 MB, mesmo sendo imagem válida", () => {
    const grande = new Uint8Array(FOTO_TAMANHO_MAXIMO + 1);
    grande.set(BYTES.jpeg);
    expect(validarFoto(grande)).toEqual({ ok: false, problema: "grande" });
    expect(validarFoto(grande.subarray(0, FOTO_TAMANHO_MAXIMO)).ok).toBe(true);
  });

  it("recusa o que não é JPEG, PNG nem WebP", () => {
    expect(validarFoto(texto("%PDF-1.7"))).toEqual({ ok: false, problema: "tipo" });
  });
});

describe("caminhos das fotos", () => {
  it("guarda cada foto na pasta do usuário, separada por ambiente", () => {
    expect(pastaDasFotos(USUARIO)).toBe(`local/usuarios/${USUARIO}/`);
    expect(novoCaminhoDeFoto(USUARIO, "image/webp")).toMatch(
      new RegExp(`^local/usuarios/${USUARIO}/[0-9a-f-]{36}\\.webp$`),
    );
  });

  it("gera um nome novo a cada envio", () => {
    expect(novoCaminhoDeFoto(USUARIO, "image/png")).not.toBe(
      novoCaminhoDeFoto(USUARIO, "image/png"),
    );
  });

  it("lê o tipo pela extensão que o próprio app gravou", () => {
    expect(lerCaminhoDeFoto(USUARIO, `local/usuarios/${USUARIO}/${UUID}.jpg`)).toEqual({
      versao: UUID,
      tipo: "image/jpeg",
    });
  });

  it.each([
    ["nulo", null],
    ["URL externa", "https://site-falso.example/foto.png"],
    ["pasta de outra pessoa", `local/usuarios/${OUTRO}/${UUID}.png`],
    ["outro ambiente", `production/usuarios/${USUARIO}/${UUID}.png`],
    ["subida de pasta", `local/usuarios/${USUARIO}/../${OUTRO}/${UUID}.png`],
    ["extensão não permitida", `local/usuarios/${USUARIO}/${UUID}.svg`],
  ])("ignora caminho fora do formato: %s", (_nome, caminho) => {
    expect(lerCaminhoDeFoto(USUARIO, caminho)).toBeNull();
    expect(enderecoDaFoto(USUARIO, caminho)).toBeNull();
  });

  it("o endereço da foto passa pela rota autenticada, com a versão do arquivo", () => {
    expect(enderecoDaFoto(USUARIO, `local/usuarios/${USUARIO}/${UUID}.webp`)).toBe(
      `/api/usuarios/${USUARIO}/foto?v=${UUID}`,
    );
  });
});

describe("armazenamento no Vercel Blob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grava sempre como privado, sem sobrescrever nem sufixo aleatório", async () => {
    await armazenamentoNoBlob.salvar("local/usuarios/x/y.png", BYTES.png, "image/png");

    expect(put).toHaveBeenCalledWith(
      "local/usuarios/x/y.png",
      expect.any(Buffer),
      expect.objectContaining({
        access: "private",
        contentType: "image/png",
        addRandomSuffix: false,
        allowOverwrite: false,
      }),
    );
  });

  it("lê como privado e devolve o conteúdo", async () => {
    const conteudo = new ReadableStream<Uint8Array>();
    vi.mocked(get).mockResolvedValue({
      statusCode: 200,
      stream: conteudo,
      headers: new Headers(),
      blob: {
        url: "",
        downloadUrl: "",
        pathname: "a.png",
        contentDisposition: "",
        cacheControl: "",
        uploadedAt: new Date(),
        etag: "",
        contentType: "image/png",
        size: 12,
      },
    });

    expect(await armazenamentoNoBlob.ler("a.png")).toEqual({ conteudo, tamanho: 12 });
    expect(get).toHaveBeenCalledWith("a.png", { access: "private" });
  });

  it("arquivo inexistente vira nulo", async () => {
    vi.mocked(get).mockResolvedValue(null);

    expect(await armazenamentoNoBlob.ler("nao-existe.png")).toBeNull();
  });

  it("remove pelo caminho", async () => {
    await armazenamentoNoBlob.remover("local/usuarios/x/y.png");

    expect(del).toHaveBeenCalledWith("local/usuarios/x/y.png");
  });

  it("fica indisponível sem credencial do Blob", () => {
    // Nos testes não há BLOB_READ_WRITE_TOKEN nem BLOB_STORE_ID.
    expect(armazenamentoNoBlob.disponivel).toBe(false);
  });
});
