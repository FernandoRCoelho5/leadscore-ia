import "server-only";

import { del, get, put } from "@vercel/blob";

import { env } from "@/env";
import { EXTENSAO_DO_TIPO, type TipoDeFoto } from "@/lib/validacao/foto";
import { uuidv7 } from "@/lib/uuid";

/**
 * Armazenamento das fotos de perfil (D-024).
 *
 * Os serviços recebem `ArmazenamentoDeFotos` por parâmetro, como recebem o
 * banco: em produção é o Vercel Blob; nos testes, uma versão em memória.
 */

export type ArquivoDeFoto = {
  conteudo: ReadableStream<Uint8Array>;
  tamanho: number;
};

export type ArmazenamentoDeFotos = {
  /** Falso quando não há credencial do Blob (o envio de foto fica indisponível). */
  disponivel: boolean;
  salvar(caminho: string, bytes: Uint8Array, tipo: TipoDeFoto): Promise<void>;
  ler(caminho: string): Promise<ArquivoDeFoto | null>;
  remover(caminho: string): Promise<void>;
};

const UM_ANO = 60 * 60 * 24 * 365;

/**
 * Vercel Blob com store PRIVADO: nenhuma foto tem endereço público. Quem vê a
 * foto passa pela rota /api/usuarios/[id]/foto, que confere a permissão.
 * Localmente o SDK usa o BLOB_READ_WRITE_TOKEN; na Vercel, OIDC.
 */
export const armazenamentoNoBlob: ArmazenamentoDeFotos = {
  disponivel: Boolean(env.BLOB_READ_WRITE_TOKEN ?? env.BLOB_STORE_ID),

  async salvar(caminho, bytes, tipo) {
    await put(caminho, Buffer.from(bytes), {
      access: "private",
      contentType: tipo,
      addRandomSuffix: false,
      allowOverwrite: false,
      // O nome do arquivo é único (UUID) e nunca é regravado: o cache não fica velho.
      cacheControlMaxAge: UM_ANO,
    });
  },

  async ler(caminho) {
    const resultado = await get(caminho, { access: "private" });
    if (resultado?.statusCode !== 200) {
      return null;
    }
    return { conteudo: resultado.stream, tamanho: resultado.blob.size };
  },

  async remover(caminho) {
    await del(caminho);
  },
};

// ---------------------------------------------------------------------------
// Caminhos: {ambiente}/usuarios/{usuarioId}/{uuid}.{jpg|png|webp}
// ---------------------------------------------------------------------------

/**
 * Pasta das fotos do usuário no ambiente atual. Produção, preview e
 * desenvolvimento usam o mesmo store, mas pastas separadas: a branch de
 * desenvolvimento do banco (cópia da produção) nunca lê nem apaga as fotos de
 * produção.
 */
export function pastaDasFotos(usuarioId: string): string {
  return `${env.VERCEL_ENV ?? "local"}/usuarios/${usuarioId}/`;
}

export function novoCaminhoDeFoto(usuarioId: string, tipo: TipoDeFoto): string {
  return `${pastaDasFotos(usuarioId)}${uuidv7()}.${EXTENSAO_DO_TIPO[tipo]}`;
}

const NOME_DO_ARQUIVO =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/;

const TIPO_DA_EXTENSAO: Record<string, TipoDeFoto> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Confere se o caminho gravado no banco tem exatamente o formato que o app
 * cria, na pasta do próprio usuário. Qualquer outro valor (uma URL externa,
 * a pasta de outra pessoa, "../") é ignorado: nunca é lido nem apagado.
 */
export function lerCaminhoDeFoto(
  usuarioId: string,
  caminho: string | null,
): { versao: string; tipo: TipoDeFoto } | null {
  const pasta = pastaDasFotos(usuarioId);
  if (!caminho?.startsWith(pasta)) {
    return null;
  }
  const partes = NOME_DO_ARQUIVO.exec(caminho.slice(pasta.length));
  const [, versao, extensao] = partes ?? [];
  const tipo = extensao ? TIPO_DA_EXTENSAO[extensao] : undefined;
  return versao && tipo ? { versao, tipo } : null;
}

/**
 * Endereço da foto para a interface. A versão (o nome do arquivo) muda a cada
 * troca, então o navegador nunca mostra a foto antiga.
 */
export function enderecoDaFoto(usuarioId: string, caminho: string | null): string | null {
  const foto = lerCaminhoDeFoto(usuarioId, caminho);
  return foto ? `/api/usuarios/${usuarioId}/foto?v=${foto.versao}` : null;
}
