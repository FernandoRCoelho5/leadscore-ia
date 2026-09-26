import "server-only";

import type { BancoDeDados } from "@/db/tipos";
import { ErroNaoEncontrado } from "@/lib/erros";
import { autorizar } from "@/server/auth/permissoes";
import { registrarAuditoria } from "@/server/repositories/auditoria";
import { atualizarNomeDoUsuario } from "@/server/repositories/usuarios";

import type { ContextoDoUsuario } from "./contexto";

/** "Alterar perfil": o usuário muda o próprio nome (a senha passa pelo Better Auth). */
export async function atualizarMeuNome(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  nome: string,
): Promise<void> {
  autorizar(contexto.ator, "perfil:editar");

  await db.transaction(async (tx) => {
    if (!(await atualizarNomeDoUsuario(tx, contexto.usuarioId, nome))) {
      throw new ErroNaoEncontrado();
    }
    // Sem o nome em `detalhes`: a auditoria não guarda dados pessoais.
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      acao: "usuario.perfil_atualizado",
      recursoTipo: "usuario",
      recursoId: contexto.usuarioId,
      detalhes: { campos: ["nome"] },
    });
  });
}
