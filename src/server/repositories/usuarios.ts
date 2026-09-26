import "server-only";

import { and, asc, count, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";

import { empresas, membrosEmpresa, usuarios, type Usuario } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import {
  deslocamento,
  esquemaPaginacao,
  montarPagina,
  type Pagina,
  type Paginacao,
} from "@/lib/paginacao";

import { ehUuid, padraoDeBusca } from "./utilitarios";

/** Acesso a dados de usuários e dos seus vínculos com empresas. */

/** Usuário não excluído (o bloqueio é conferido por quem chama). */
export async function obterUsuarioAtivo(
  db: BancoDeDados,
  usuarioId: string,
): Promise<Usuario | undefined> {
  if (!ehUuid(usuarioId)) {
    return undefined;
  }
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), isNull(usuarios.deletedAt)))
    .limit(1);
  return usuario;
}

export async function atualizarNomeDoUsuario(
  db: BancoDeDados,
  usuarioId: string,
  nome: string,
): Promise<boolean> {
  const atualizados = await db
    .update(usuarios)
    .set({ nome })
    .where(and(eq(usuarios.id, usuarioId), isNull(usuarios.deletedAt)))
    .returning({ id: usuarios.id });
  return atualizados.length > 0;
}

/**
 * Troca a foto (caminho do arquivo no armazenamento; nulo para remover) e
 * devolve a anterior, cujo arquivo será apagado. A linha fica travada
 * (FOR UPDATE) até o fim da transação: duas trocas ao mesmo tempo não perdem a
 * referência de um arquivo. Deve ser chamada dentro de uma transação.
 */
export async function trocarFotoDoUsuario(
  db: BancoDeDados,
  usuarioId: string,
  caminho: string | null,
): Promise<{ anterior: string | null } | undefined> {
  const [atual] = await db
    .select({ imagemUrl: usuarios.imagemUrl })
    .from(usuarios)
    .where(and(eq(usuarios.id, usuarioId), isNull(usuarios.deletedAt)))
    .for("update");
  if (!atual) {
    return undefined;
  }
  await db.update(usuarios).set({ imagemUrl: caminho }).where(eq(usuarios.id, usuarioId));
  return { anterior: atual.imagemUrl };
}

export type VinculoDeEmpresa = {
  empresaId: string;
  nome: string;
  slug: string;
};

/** Empresas ativas das quais o usuário é membro (vínculo e empresa não excluídos). */
export async function listarEmpresasDoUsuario(
  db: BancoDeDados,
  usuarioId: string,
): Promise<VinculoDeEmpresa[]> {
  return db
    .select({ empresaId: empresas.id, nome: empresas.nome, slug: empresas.slug })
    .from(membrosEmpresa)
    .innerJoin(empresas, eq(empresas.id, membrosEmpresa.empresaId))
    .where(
      and(
        eq(membrosEmpresa.usuarioId, usuarioId),
        isNull(membrosEmpresa.deletedAt),
        isNull(empresas.deletedAt),
        eq(empresas.status, "ativa"),
      ),
    )
    .orderBy(asc(membrosEmpresa.createdAt));
}

export async function criarVinculo(
  db: BancoDeDados,
  usuarioId: string,
  empresaId: string,
): Promise<void> {
  await db.insert(membrosEmpresa).values({ usuarioId, empresaId, papel: "cliente" });
}

export type FiltrosDeUsuarios = {
  busca?: string;
  papel?: "admin" | "suporte" | "cliente";
  situacao?: "ativo" | "bloqueado";
};

/** Só o que a lista mostra: nunca a foto, tokens ou dados de autenticação. */
export type UsuarioNaLista = Pick<
  Usuario,
  "id" | "nome" | "email" | "papelPlataforma" | "bloqueadoEm" | "createdAt"
> & { empresas: string | null };

/** Lista da administração (equipe Brasa), com as empresas de cada usuário. */
export async function listarUsuarios(
  db: BancoDeDados,
  filtros: FiltrosDeUsuarios,
  paginacao: Partial<Paginacao>,
): Promise<Pagina<UsuarioNaLista>> {
  const pagina = esquemaPaginacao.parse(paginacao);
  const condicoes: SQL[] = [isNull(usuarios.deletedAt)];
  const termo = filtros.busca?.trim();
  if (termo) {
    const busca = or(
      ilike(usuarios.nome, padraoDeBusca(termo)),
      ilike(usuarios.email, padraoDeBusca(termo)),
    );
    if (busca) {
      condicoes.push(busca);
    }
  }
  if (filtros.papel === "cliente") {
    condicoes.push(isNull(usuarios.papelPlataforma));
  } else if (filtros.papel) {
    condicoes.push(eq(usuarios.papelPlataforma, filtros.papel));
  }
  if (filtros.situacao === "ativo") {
    condicoes.push(isNull(usuarios.bloqueadoEm));
  } else if (filtros.situacao === "bloqueado") {
    condicoes.push(isNotNull(usuarios.bloqueadoEm));
  }
  const filtro = and(...condicoes);

  const [itens, [linhaDoTotal]] = await Promise.all([
    db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        papelPlataforma: usuarios.papelPlataforma,
        bloqueadoEm: usuarios.bloqueadoEm,
        createdAt: usuarios.createdAt,
        // Apelidos explícitos (m, e): sem eles, as colunas da subconsulta e as de
        // "usuarios" ficariam ambíguas (o Drizzle não qualifica colunas no SELECT).
        empresas: sql<string | null>`(
          select string_agg(e.nome, ', ' order by e.nome)
          from membros_empresa m
          join empresas e on e.id = m.empresa_id
          where m.usuario_id = "usuarios"."id"
            and m.deleted_at is null
            and e.deleted_at is null
        )`,
      })
      .from(usuarios)
      .where(filtro)
      .orderBy(asc(usuarios.nome), asc(usuarios.id))
      .limit(pagina.porPagina)
      .offset(deslocamento(pagina)),
    db.select({ total: count() }).from(usuarios).where(filtro),
  ]);
  return montarPagina(itens, linhaDoTotal?.total ?? 0, pagina);
}

/**
 * Bloqueia (ou desbloqueia) o login. O bloqueio vale na hora: a sessão relê o
 * usuário a cada requisição e recusa quem está bloqueado.
 */
export async function alterarBloqueioDoUsuario(
  db: BancoDeDados,
  usuarioId: string,
  bloquear: boolean,
  agora: Date = new Date(),
): Promise<boolean> {
  if (!ehUuid(usuarioId)) {
    return false;
  }
  const atualizados = await db
    .update(usuarios)
    .set({ bloqueadoEm: bloquear ? agora : null })
    .where(and(eq(usuarios.id, usuarioId), isNull(usuarios.deletedAt)))
    .returning({ id: usuarios.id });
  return atualizados.length > 0;
}
