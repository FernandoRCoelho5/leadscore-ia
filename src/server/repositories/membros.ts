import "server-only";

import { and, asc, count, desc, eq, gt, isNull } from "drizzle-orm";

import { convites, empresas, membrosEmpresa, usuarios, type Convite } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import {
  deslocamento,
  esquemaPaginacao,
  montarPagina,
  type Pagina,
  type Paginacao,
} from "@/lib/paginacao";

import { ehUuid } from "./utilitarios";

/** Acesso a dados das pessoas de cada empresa (vínculos) e dos convites (D-030). */

export type MembroNaLista = {
  usuarioId: string;
  nome: string;
  email: string;
  imagemUrl: string | null;
  bloqueado: boolean;
  /** Quando entrou na empresa (criação do vínculo). */
  desde: Date;
};

const vinculoAtivo = (empresaId: string) =>
  and(eq(membrosEmpresa.empresaId, empresaId), isNull(membrosEmpresa.deletedAt));

/** Pessoas da empresa, por nome, com paginação. */
export async function listarMembros(
  db: BancoDeDados,
  empresaId: string,
  paginacao: Partial<Paginacao>,
): Promise<Pagina<MembroNaLista>> {
  const pagina = esquemaPaginacao.parse(paginacao);
  const filtro = and(vinculoAtivo(empresaId), isNull(usuarios.deletedAt));

  const [linhas, [linhaDoTotal]] = await Promise.all([
    db
      .select({
        usuarioId: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        imagemUrl: usuarios.imagemUrl,
        bloqueadoEm: usuarios.bloqueadoEm,
        desde: membrosEmpresa.createdAt,
      })
      .from(membrosEmpresa)
      .innerJoin(usuarios, eq(usuarios.id, membrosEmpresa.usuarioId))
      .where(filtro)
      .orderBy(asc(usuarios.nome), asc(usuarios.id))
      .limit(pagina.porPagina)
      .offset(deslocamento(pagina)),
    db
      .select({ total: count() })
      .from(membrosEmpresa)
      .innerJoin(usuarios, eq(usuarios.id, membrosEmpresa.usuarioId))
      .where(filtro),
  ]);

  const itens = linhas.map(({ bloqueadoEm, ...membro }) => ({
    ...membro,
    bloqueado: bloqueadoEm !== null,
  }));
  return montarPagina(itens, linhaDoTotal?.total ?? 0, pagina);
}

/** O usuário (com este e-mail) já é membro da empresa? */
export async function emailJaEhMembro(
  db: BancoDeDados,
  empresaId: string,
  email: string,
): Promise<boolean> {
  const [vinculo] = await db
    .select({ id: membrosEmpresa.id })
    .from(membrosEmpresa)
    .innerJoin(usuarios, eq(usuarios.id, membrosEmpresa.usuarioId))
    .where(and(vinculoAtivo(empresaId), isNull(usuarios.deletedAt), eq(usuarios.email, email)))
    .limit(1);
  return vinculo !== undefined;
}

/**
 * Trava os vínculos ativos da empresa (FOR UPDATE) e devolve os ids dos
 * membros. Duas remoções ao mesmo tempo esperam uma pela outra: a empresa
 * nunca fica sem ninguém. Deve ser chamada dentro de uma transação.
 */
export async function travarMembros(db: BancoDeDados, empresaId: string): Promise<string[]> {
  const linhas = await db
    .select({ usuarioId: membrosEmpresa.usuarioId })
    .from(membrosEmpresa)
    .where(vinculoAtivo(empresaId))
    .for("update");
  return linhas.map((linha) => linha.usuarioId);
}

/** Remove o vínculo (exclusão lógica). Devolve `false` se ele não existia. */
export async function removerVinculo(
  db: BancoDeDados,
  empresaId: string,
  usuarioId: string,
  agora: Date = new Date(),
): Promise<boolean> {
  if (!ehUuid(usuarioId)) {
    return false;
  }
  const removidos = await db
    .update(membrosEmpresa)
    .set({ deletedAt: agora })
    .where(and(vinculoAtivo(empresaId), eq(membrosEmpresa.usuarioId, usuarioId)))
    .returning({ id: membrosEmpresa.id });
  return removidos.length > 0;
}

// Convites ------------------------------------------------------------------

/** Convite que ainda pode ser usado: não aceito, não cancelado e não vencido. */
const convitePendente = (agora: Date) =>
  and(isNull(convites.aceitoEm), isNull(convites.deletedAt), gt(convites.expiraEm, agora));

export async function criarConvite(
  db: BancoDeDados,
  dados: Pick<Convite, "empresaId" | "email" | "tokenHash" | "expiraEm" | "criadoPor">,
): Promise<Convite> {
  const [convite] = await db.insert(convites).values(dados).returning();
  if (!convite) {
    throw new Error("O banco não devolveu o convite inserido.");
  }
  return convite;
}

export type ConviteNaLista = Pick<Convite, "id" | "email" | "expiraEm" | "createdAt"> & {
  criadoPorNome: string | null;
};

/** Convites pendentes da empresa, do mais novo para o mais antigo (são poucos: há um teto). */
export async function listarConvitesPendentes(
  db: BancoDeDados,
  empresaId: string,
  agora: Date = new Date(),
): Promise<ConviteNaLista[]> {
  return db
    .select({
      id: convites.id,
      email: convites.email,
      expiraEm: convites.expiraEm,
      createdAt: convites.createdAt,
      criadoPorNome: usuarios.nome,
    })
    .from(convites)
    .leftJoin(usuarios, eq(usuarios.id, convites.criadoPor))
    .where(and(eq(convites.empresaId, empresaId), convitePendente(agora)))
    .orderBy(desc(convites.createdAt));
}

export async function contarConvitesPendentes(
  db: BancoDeDados,
  empresaId: string,
  agora: Date = new Date(),
): Promise<number> {
  const [linha] = await db
    .select({ total: count() })
    .from(convites)
    .where(and(eq(convites.empresaId, empresaId), convitePendente(agora)));
  return linha?.total ?? 0;
}

/** Já existe convite pendente para este e-mail nesta empresa? */
export async function existeConvitePendente(
  db: BancoDeDados,
  empresaId: string,
  email: string,
  agora: Date = new Date(),
): Promise<boolean> {
  const [convite] = await db
    .select({ id: convites.id })
    .from(convites)
    .where(
      and(eq(convites.empresaId, empresaId), eq(convites.email, email), convitePendente(agora)),
    )
    .limit(1);
  return convite !== undefined;
}

/** Cancela (exclusão lógica) um convite ainda não aceito da empresa. */
export async function cancelarConvite(
  db: BancoDeDados,
  empresaId: string,
  conviteId: string,
  agora: Date = new Date(),
): Promise<boolean> {
  if (!ehUuid(conviteId)) {
    return false;
  }
  const cancelados = await db
    .update(convites)
    .set({ deletedAt: agora })
    .where(
      and(
        eq(convites.id, conviteId),
        eq(convites.empresaId, empresaId),
        isNull(convites.aceitoEm),
        isNull(convites.deletedAt),
      ),
    )
    .returning({ id: convites.id });
  return cancelados.length > 0;
}

export type ConviteComEmpresa = Convite & {
  empresaNome: string;
  empresaAtiva: boolean;
};

/**
 * Convite pelo hash do token, com a empresa. Com `travar`, a linha fica presa
 * até o fim da transação: dois cliques em "Aceitar" não criam dois vínculos.
 */
export async function obterConvitePorHash(
  db: BancoDeDados,
  tokenHash: string,
  { travar = false }: { travar?: boolean } = {},
): Promise<ConviteComEmpresa | undefined> {
  const consulta = db
    .select({
      convite: convites,
      empresaNome: empresas.nome,
      empresaStatus: empresas.status,
      empresaExcluidaEm: empresas.deletedAt,
    })
    .from(convites)
    .innerJoin(empresas, eq(empresas.id, convites.empresaId))
    .where(eq(convites.tokenHash, tokenHash))
    .limit(1);
  const [linha] = travar ? await consulta.for("update", { of: convites }) : await consulta;
  if (!linha) {
    return undefined;
  }
  return {
    ...linha.convite,
    empresaNome: linha.empresaNome,
    empresaAtiva: linha.empresaStatus === "ativa" && linha.empresaExcluidaEm === null,
  };
}

/** Marca o convite como aceito, só se ninguém o aceitou antes. */
export async function marcarConviteAceito(
  db: BancoDeDados,
  conviteId: string,
  agora: Date = new Date(),
): Promise<boolean> {
  const aceitos = await db
    .update(convites)
    .set({ aceitoEm: agora })
    .where(and(eq(convites.id, conviteId), isNull(convites.aceitoEm), isNull(convites.deletedAt)))
    .returning({ id: convites.id });
  return aceitos.length > 0;
}
