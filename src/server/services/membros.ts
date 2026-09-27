import "server-only";

import type { BancoDeDados } from "@/db/tipos";
import {
  ErroConflito,
  ErroLimiteExcedido,
  ErroNaoEncontrado,
  ErroProibido,
  ErroValidacao,
} from "@/lib/erros";
import type { Pagina, Paginacao } from "@/lib/paginacao";
import { DIAS_DE_VALIDADE_DO_CONVITE, esquemaConvite } from "@/lib/validacao/membros";
import { autorizar } from "@/server/auth/permissoes";
import { contarAcoesRecentes, registrarAuditoria } from "@/server/repositories/auditoria";
import {
  cancelarConvite,
  contarConvitesPendentes,
  criarConvite,
  emailJaEhMembro,
  existeConvitePendente,
  listarConvitesPendentes,
  listarMembros,
  marcarConviteAceito,
  obterConvitePorHash,
  removerVinculo,
  travarMembros,
  type ConviteNaLista,
  type MembroNaLista,
} from "@/server/repositories/membros";
import { criarVinculo, obterUsuarioAtivo } from "@/server/repositories/usuarios";
import { gerarToken, hashDoToken, temFormatoDeToken } from "@/server/seguranca/tokens";

import { ehViolacaoDeUnicidade, type ContextoDoUsuario } from "./contexto";

/**
 * Pessoas da empresa e convites por link (D-030). O cliente gere a própria
 * empresa; admin, qualquer uma; o suporte só vê. Toda alteração vai para a
 * auditoria, sem o e-mail convidado (dado pessoal) nos detalhes.
 */

/** Teto de convites pendentes por empresa: a lista cabe numa tela e ninguém gera links em massa. */
export const CONVITES_PENDENTES_POR_EMPRESA = 20;
/** Convites que uma pessoa pode criar por hora. */
export const CONVITES_POR_HORA = 30;

const UMA_HORA_EM_MS = 60 * 60 * 1000;
const UM_DIA_EM_MS = 24 * UMA_HORA_EM_MS;

export async function listarMembrosDaEmpresa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  paginacao: Partial<Paginacao>,
): Promise<Pagina<MembroNaLista>> {
  autorizar(contexto.ator, "membros:ver", empresaId);
  return listarMembros(db, empresaId, paginacao);
}

export async function listarConvitesDaEmpresa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  agora: Date = new Date(),
): Promise<ConviteNaLista[]> {
  autorizar(contexto.ator, "membros:ver", empresaId);
  return listarConvitesPendentes(db, empresaId, agora);
}

export type ConviteCriado = { conviteId: string; token: string; email: string; expiraEm: Date };

/**
 * Cria o convite e devolve o token (a única vez em que ele existe fora do
 * link). O banco guarda só o hash.
 */
export async function convidarPessoa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  dados: unknown,
  agora: Date = new Date(),
): Promise<ConviteCriado> {
  autorizar(contexto.ator, "membros:gerir", empresaId);
  const validacao = esquemaConvite.safeParse(dados);
  if (!validacao.success) {
    throw ErroValidacao.deZod(validacao.error);
  }
  const { email } = validacao.data;

  if (await emailJaEhMembro(db, empresaId, email)) {
    throw erroNoEmail("Essa pessoa já faz parte da empresa.");
  }
  if (await existeConvitePendente(db, empresaId, email, agora)) {
    throw erroNoEmail(
      "Já existe um convite pendente para esse e-mail. Cancele-o para gerar um link novo.",
    );
  }
  if ((await contarConvitesPendentes(db, empresaId, agora)) >= CONVITES_PENDENTES_POR_EMPRESA) {
    throw new ErroConflito(
      `A empresa já tem ${CONVITES_PENDENTES_POR_EMPRESA} convites pendentes. Cancele algum para convidar outra pessoa.`,
    );
  }
  const desde = new Date(agora.getTime() - UMA_HORA_EM_MS);
  if (
    (await contarAcoesRecentes(db, contexto.usuarioId, "convite.criado", desde)) >=
    CONVITES_POR_HORA
  ) {
    throw new ErroLimiteExcedido(
      "Você criou muitos convites na última hora. Tente de novo mais tarde.",
      UMA_HORA_EM_MS / 1000,
    );
  }

  const { token, hash } = gerarToken();
  const expiraEm = new Date(agora.getTime() + DIAS_DE_VALIDADE_DO_CONVITE * UM_DIA_EM_MS);
  const convite = await db.transaction(async (tx) => {
    const criado = await criarConvite(tx, {
      empresaId,
      email,
      tokenHash: hash,
      expiraEm,
      criadoPor: contexto.usuarioId,
    });
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId,
      acao: "convite.criado",
      recursoTipo: "convite",
      recursoId: criado.id,
    });
    return criado;
  });
  return { conviteId: convite.id, token, email, expiraEm };
}

function erroNoEmail(mensagem: string): ErroValidacao {
  return new ErroValidacao([{ campo: "email", mensagem }], mensagem);
}

export async function cancelarConviteDaEmpresa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  conviteId: string,
): Promise<void> {
  autorizar(contexto.ator, "membros:gerir", empresaId);
  await db.transaction(async (tx) => {
    if (!(await cancelarConvite(tx, empresaId, conviteId))) {
      throw new ErroNaoEncontrado("Convite não encontrado.");
    }
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId,
      acao: "convite.cancelado",
      recursoTipo: "convite",
      recursoId: conviteId,
    });
  });
}

/**
 * Tira a pessoa da empresa (exclusão lógica do vínculo): ela perde o acesso na
 * hora, porque a sessão relê os vínculos a cada requisição. Ninguém remove a
 * si mesmo, e a empresa nunca fica sem nenhuma pessoa.
 */
export async function removerMembroDaEmpresa(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  usuarioId: string,
): Promise<void> {
  autorizar(contexto.ator, "membros:gerir", empresaId);
  if (usuarioId === contexto.usuarioId) {
    throw new ErroConflito("Você não pode remover a si mesmo da empresa.");
  }
  await db.transaction(async (tx) => {
    const membros = await travarMembros(tx, empresaId);
    if (!membros.includes(usuarioId)) {
      throw new ErroNaoEncontrado("Essa pessoa não faz parte da empresa.");
    }
    if (membros.length <= 1) {
      throw new ErroConflito("A empresa precisa de pelo menos uma pessoa.");
    }
    await removerVinculo(tx, empresaId, usuarioId);
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId,
      acao: "membro.removido",
      recursoTipo: "usuario",
      recursoId: usuarioId,
    });
  });
}

export type SituacaoDoConvite =
  | { situacao: "invalido" }
  | { situacao: "usado"; empresaNome: string }
  | { situacao: "expirado"; empresaNome: string }
  | { situacao: "valido"; empresaNome: string; email: string };

/**
 * O que a página do convite mostra, sem exigir login. Só quem tem o link
 * chega aqui, e o token tem 256 bits: não dá para adivinhar outros convites.
 */
export async function consultarConvite(
  db: BancoDeDados,
  token: string,
  agora: Date = new Date(),
): Promise<SituacaoDoConvite> {
  if (!temFormatoDeToken(token)) {
    return { situacao: "invalido" };
  }
  const convite = await obterConvitePorHash(db, hashDoToken(token));
  if (!convite || convite.deletedAt || !convite.empresaAtiva) {
    return { situacao: "invalido" };
  }
  if (convite.aceitoEm) {
    return { situacao: "usado", empresaNome: convite.empresaNome };
  }
  if (convite.expiraEm <= agora) {
    return { situacao: "expirado", empresaNome: convite.empresaNome };
  }
  return { situacao: "valido", empresaNome: convite.empresaNome, email: convite.email };
}

/**
 * Aceita o convite: cria o vínculo e marca o convite como usado, na mesma
 * transação e com o convite travado. Só vale para quem entrou com o e-mail
 * convidado, e só para clientes (a equipe Brasa já vê todas as empresas).
 */
export async function aceitarConvite(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  token: string,
  agora: Date = new Date(),
): Promise<{ empresaId: string }> {
  if (contexto.ator.papel !== "cliente") {
    throw new ErroProibido("Contas da equipe Brasa não entram em empresas de clientes.");
  }
  if (!temFormatoDeToken(token)) {
    throw new ErroNaoEncontrado("Convite inválido.");
  }
  const usuario = await obterUsuarioAtivo(db, contexto.usuarioId);
  if (!usuario) {
    throw new ErroNaoEncontrado("Convite inválido.");
  }

  try {
    return await db.transaction(async (tx) => {
      const convite = await obterConvitePorHash(tx, hashDoToken(token), { travar: true });
      if (!convite || convite.deletedAt || !convite.empresaAtiva) {
        throw new ErroNaoEncontrado("Convite inválido.");
      }
      if (convite.aceitoEm) {
        throw new ErroConflito("Este convite já foi usado.");
      }
      if (convite.expiraEm <= agora) {
        throw new ErroConflito("Este convite expirou. Peça um novo a quem convidou você.");
      }
      if (convite.email !== usuario.email.toLowerCase()) {
        throw new ErroProibido(
          "Este convite é para outro e-mail. Entre com a conta do e-mail convidado.",
        );
      }
      if (await emailJaEhMembro(tx, convite.empresaId, convite.email)) {
        throw new ErroConflito("Você já faz parte desta empresa.");
      }
      await criarVinculo(tx, usuario.id, convite.empresaId);
      await marcarConviteAceito(tx, convite.id, agora);
      await registrarAuditoria(tx, {
        atorId: usuario.id,
        empresaId: convite.empresaId,
        acao: "convite.aceito",
        recursoTipo: "convite",
        recursoId: convite.id,
      });
      return { empresaId: convite.empresaId };
    });
  } catch (erro) {
    // Vínculo criado por outra via ao mesmo tempo: o índice único decide.
    if (ehViolacaoDeUnicidade(erro)) {
      throw new ErroConflito("Você já faz parte desta empresa.");
    }
    throw erro;
  }
}
