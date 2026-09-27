import { Avatar } from "@/components/ui/Avisos";
import { SeloDeSituacao, SeloDoPapel } from "@/components/ui/Selos";
import { formatarData } from "@/lib/datas";
import { ROTULO_DA_SITUACAO_DO_USUARIO } from "@/lib/rotulos";
import type { UsuarioNaLista } from "@/server/repositories/usuarios";

import { AlterarPapel } from "./AlterarPapel";
import { BloqueioDoUsuario } from "./BloqueioDoUsuario";

/**
 * Usuários da página atual: tabela no computador e cartões no celular. A
 * lista não traz fotos (só as iniciais): a rota da foto é conferida por
 * pessoa, e uma página com 100 fotos seriam 100 pedidos a mais.
 */

function Situacao({ usuario }: { usuario: UsuarioNaLista }) {
  const bloqueado = usuario.bloqueadoEm !== null;
  return (
    <SeloDeSituacao
      bloqueado={bloqueado}
      rotulo={ROTULO_DA_SITUACAO_DO_USUARIO[bloqueado ? "bloqueado" : "ativo"]}
    />
  );
}

function Pessoa({ usuario }: { usuario: UsuarioNaLista }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar nome={usuario.nome} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{usuario.nome}</p>
        <p className="truncate text-sm text-texto-suave">{usuario.email}</p>
      </div>
    </div>
  );
}

export function ListaDeUsuarios({
  usuarios,
  usuarioAtualId,
  podeGerir,
}: {
  usuarios: UsuarioNaLista[];
  /** Quem está vendo a lista: não altera a própria conta. */
  usuarioAtualId: string;
  /** Admin: muda o perfil de acesso e bloqueia. */
  podeGerir: boolean;
}) {
  const podeAgirSobre = (usuario: UsuarioNaLista) => podeGerir && usuario.id !== usuarioAtualId;
  const acoes = (usuario: UsuarioNaLista) => (
    <div className="flex flex-wrap items-start gap-2 md:flex-nowrap">
      <AlterarPapel
        usuario={{
          id: usuario.id,
          nome: usuario.nome,
          papel: usuario.papelPlataforma ?? "cliente",
        }}
      />
      <BloqueioDoUsuario
        usuario={{ id: usuario.id, nome: usuario.nome, bloqueado: usuario.bloqueadoEm !== null }}
      />
    </div>
  );

  return (
    <>
      {/* Celular: cartões. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {usuarios.map((usuario) => (
          <li key={usuario.id} className="rounded-lg border border-borda bg-superficie p-4">
            <Pessoa usuario={usuario} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SeloDoPapel papel={usuario.papelPlataforma ?? "cliente"} />
              <Situacao usuario={usuario} />
            </div>
            {usuario.empresas && (
              <p className="mt-2 text-sm">
                <span className="text-texto-suave">Empresas: </span>
                {usuario.empresas}
              </p>
            )}
            <p className="mt-1 text-xs text-texto-suave">Desde {formatarData(usuario.createdAt)}</p>
            {podeAgirSobre(usuario) && <div className="mt-3">{acoes(usuario)}</div>}
          </li>
        ))}
      </ul>

      {/* Computador: tabela. */}
      <div className="hidden overflow-hidden rounded-lg border border-borda bg-superficie md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Usuários da plataforma</caption>
          <thead className="border-b border-borda bg-superficie-2 text-texto-suave">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Usuário
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Perfil
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Empresas
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Situação
              </th>
              <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                Criado em
              </th>
              {podeGerir && (
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td className="max-w-72 px-4 py-3">
                  <Pessoa usuario={usuario} />
                </td>
                <td className="px-4 py-3">
                  <SeloDoPapel papel={usuario.papelPlataforma ?? "cliente"} />
                </td>
                <td className="max-w-56 px-4 py-3">
                  {usuario.empresas ? (
                    <span className="line-clamp-2">{usuario.empresas}</span>
                  ) : (
                    <span className="text-texto-suave">Nenhuma</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Situacao usuario={usuario} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-texto-suave tabular-nums">
                  {formatarData(usuario.createdAt)}
                </td>
                {podeGerir && (
                  <td className="w-px px-4 py-3 whitespace-nowrap">
                    <div className="flex justify-end">
                      {podeAgirSobre(usuario) ? (
                        acoes(usuario)
                      ) : (
                        <span className="text-sm text-texto-suave">Você</span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
