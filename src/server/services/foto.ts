import "server-only";

import type { BancoDeDados } from "@/db/tipos";
import {
  ErroIndisponivel,
  ErroLimiteExcedido,
  ErroNaoEncontrado,
  ErroValidacao,
} from "@/lib/erros";
import { logger } from "@/lib/logger";
import {
  MENSAGEM_DO_PROBLEMA,
  validarFoto,
  type ProblemaNaFoto,
  type TipoDeFoto,
} from "@/lib/validacao/foto";
import {
  lerCaminhoDeFoto,
  novoCaminhoDeFoto,
  type ArmazenamentoDeFotos,
  type ArquivoDeFoto,
} from "@/server/armazenamento/fotos";
import { autorizar, podeVerPerfil } from "@/server/auth/permissoes";
import { contarAcoesRecentes, registrarAuditoria } from "@/server/repositories/auditoria";
import {
  listarEmpresasDoUsuario,
  obterUsuarioAtivo,
  trocarFotoDoUsuario,
} from "@/server/repositories/usuarios";

import type { ContextoDoUsuario } from "./contexto";

/** "Alterar perfil": envio, remoção e leitura da foto (D-024). */

/** Cada troca grava e apaga arquivos no Blob: o limite evita abuso e custo. */
export const TROCAS_DE_FOTO_POR_HORA = 10;
const UMA_HORA_EM_MS = 60 * 60 * 1000;

export function erroDeFoto(problema: ProblemaNaFoto): ErroValidacao {
  const mensagem = MENSAGEM_DO_PROBLEMA[problema];
  return new ErroValidacao([{ campo: "foto", mensagem }], mensagem);
}

function exigirArmazenamento(armazenamento: ArmazenamentoDeFotos): void {
  if (!armazenamento.disponivel) {
    throw new ErroIndisponivel("O envio de fotos não está disponível no momento.");
  }
}

/**
 * Apaga um arquivo sem derrubar a operação principal: se falhar, fica só no
 * log. Só apaga caminhos no formato do app e na pasta do próprio usuário.
 */
async function removerSemFalhar(
  armazenamento: ArmazenamentoDeFotos,
  usuarioId: string,
  caminho: string | null,
): Promise<void> {
  if (!armazenamento.disponivel || !caminho || !lerCaminhoDeFoto(usuarioId, caminho)) {
    return;
  }
  try {
    await armazenamento.remover(caminho);
  } catch (erro) {
    logger.error("Falha ao apagar um arquivo de foto", { usuarioId, erro });
  }
}

/**
 * Troca a foto do próprio usuário. O arquivo novo é gravado primeiro; o banco
 * passa a apontar para ele numa transação (com auditoria); por fim o arquivo
 * antigo é apagado. Se o banco falhar, o arquivo novo é apagado.
 */
export async function alterarMinhaFoto(
  db: BancoDeDados,
  armazenamento: ArmazenamentoDeFotos,
  contexto: ContextoDoUsuario,
  bytes: Uint8Array,
): Promise<void> {
  autorizar(contexto.ator, "perfil:editar");
  exigirArmazenamento(armazenamento);

  const validacao = validarFoto(bytes);
  if (!validacao.ok) {
    throw erroDeFoto(validacao.problema);
  }

  const desde = new Date(Date.now() - UMA_HORA_EM_MS);
  const trocas = await contarAcoesRecentes(db, contexto.usuarioId, "usuario.foto_alterada", desde);
  if (trocas >= TROCAS_DE_FOTO_POR_HORA) {
    throw new ErroLimiteExcedido(
      "Você trocou a foto muitas vezes na última hora. Tente de novo mais tarde.",
      UMA_HORA_EM_MS / 1000,
    );
  }

  const caminho = novoCaminhoDeFoto(contexto.usuarioId, validacao.tipo);
  await armazenamento.salvar(caminho, bytes, validacao.tipo);

  let anterior: string | null;
  try {
    anterior = await db.transaction(async (tx) => {
      const troca = await trocarFotoDoUsuario(tx, contexto.usuarioId, caminho);
      if (!troca) {
        throw new ErroNaoEncontrado();
      }
      await registrarAuditoria(tx, {
        atorId: contexto.usuarioId,
        acao: "usuario.foto_alterada",
        recursoTipo: "usuario",
        recursoId: contexto.usuarioId,
        detalhes: { tipo: validacao.tipo, bytes: bytes.length },
      });
      return troca.anterior;
    });
  } catch (erro) {
    // Sem o registro no banco, o arquivo novo ficaria órfão no armazenamento.
    await removerSemFalhar(armazenamento, contexto.usuarioId, caminho);
    throw erro;
  }

  await removerSemFalhar(armazenamento, contexto.usuarioId, anterior);
}

/** Remove a foto do próprio usuário (o avatar volta a mostrar as iniciais). */
export async function removerMinhaFoto(
  db: BancoDeDados,
  armazenamento: ArmazenamentoDeFotos,
  contexto: ContextoDoUsuario,
): Promise<void> {
  autorizar(contexto.ator, "perfil:editar");

  const anterior = await db.transaction(async (tx) => {
    const troca = await trocarFotoDoUsuario(tx, contexto.usuarioId, null);
    if (!troca) {
      throw new ErroNaoEncontrado();
    }
    if (troca.anterior) {
      await registrarAuditoria(tx, {
        atorId: contexto.usuarioId,
        acao: "usuario.foto_removida",
        recursoTipo: "usuario",
        recursoId: contexto.usuarioId,
      });
    }
    return troca.anterior;
  });

  // A foto é um dado pessoal: removida do perfil, o arquivo também é apagado (LGPD).
  await removerSemFalhar(armazenamento, contexto.usuarioId, anterior);
}

/**
 * Foto de um usuário, para a rota que a entrega. Sem permissão, sem foto ou
 * usuário inexistente, a resposta é a mesma (404): não revela quem existe.
 */
export async function obterFotoDoUsuario(
  db: BancoDeDados,
  armazenamento: ArmazenamentoDeFotos,
  contexto: ContextoDoUsuario,
  usuarioId: string,
): Promise<ArquivoDeFoto & { tipo: TipoDeFoto }> {
  const alvo = await obterUsuarioAtivo(db, usuarioId);
  if (!alvo) {
    throw new ErroNaoEncontrado();
  }

  const empresaIds =
    alvo.id === contexto.usuarioId
      ? []
      : (await listarEmpresasDoUsuario(db, alvo.id)).map((vinculo) => vinculo.empresaId);
  if (!podeVerPerfil(contexto.ator, contexto.usuarioId, { id: alvo.id, empresaIds })) {
    throw new ErroNaoEncontrado();
  }

  const foto = lerCaminhoDeFoto(alvo.id, alvo.imagemUrl);
  if (!foto || !alvo.imagemUrl || !armazenamento.disponivel) {
    throw new ErroNaoEncontrado();
  }
  const arquivo = await armazenamento.ler(alvo.imagemUrl);
  if (!arquivo) {
    throw new ErroNaoEncontrado();
  }
  return { ...arquivo, tipo: foto.tipo };
}
