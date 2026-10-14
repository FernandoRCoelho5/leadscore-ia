import { Avatar } from "@/components/ui/Avisos";
import { SeloDeSituacao, SeloDoPapel } from "@/components/ui/Selos";
import { Linha, Tabela, Td, Th } from "@/components/ui/Tabela";
import { formatarData } from "@/lib/datas";
import { ROTULO_DA_SITUACAO_DO_USUARIO } from "@/lib/rotulos";
import type { UsuarioNaLista } from "@/server/repositories/usuarios";

import { GerenciarUsuario } from "./GerenciarUsuario";

/**
 * Usuários da página atual: tabela nas telas largas e cartões no celular e
 * no tablet (ver ListaDeEmpresas). A
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
    <GerenciarUsuario
      usuario={{
        id: usuario.id,
        nome: usuario.nome,
        papel: usuario.papelPlataforma ?? "cliente",
        bloqueado: usuario.bloqueadoEm !== null,
      }}
    />
  );

  return (
    <>
      {/* Celular e tablet: cartões (duas colunas no tablet). */}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
        {usuarios.map((usuario) => (
          <li key={usuario.id} className="rounded-lg border border-borda bg-superficie p-4">
            <Pessoa usuario={usuario} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SeloDoPapel papel={usuario.papelPlataforma ?? "cliente"} />
              <Situacao usuario={usuario} />
            </div>
            {usuario.empresas && (
              <p className="mt-2 text-sm break-words">
                <span className="text-texto-suave">Empresas: </span>
                {usuario.empresas}
              </p>
            )}
            <p className="mt-1 text-xs text-texto-suave">Desde {formatarData(usuario.createdAt)}</p>
            {podeAgirSobre(usuario) && <div className="mt-3">{acoes(usuario)}</div>}
          </li>
        ))}
      </ul>

      {/* Telas largas: tabela. */}
      <Tabela
        legenda="Usuários da plataforma"
        className="hidden xl:block"
        cabecalho={
          <>
            <Th>Usuário</Th>
            <Th className="w-32">Perfil</Th>
            <Th className="w-48">Empresas</Th>
            <Th className="w-32">Situação</Th>
            <Th className="w-28 whitespace-nowrap">Criado em</Th>
            {podeGerir && (
              <Th className="w-40">
                <span className="sr-only">Ações</span>
              </Th>
            )}
          </>
        }
      >
        {usuarios.map((usuario) => (
          <Linha key={usuario.id}>
            <Td>
              <Pessoa usuario={usuario} />
            </Td>
            <Td>
              <SeloDoPapel papel={usuario.papelPlataforma ?? "cliente"} />
            </Td>
            <Td>
              {usuario.empresas ? (
                <span className="line-clamp-2">{usuario.empresas}</span>
              ) : (
                <span className="text-texto-suave">Nenhuma</span>
              )}
            </Td>
            <Td>
              <Situacao usuario={usuario} />
            </Td>
            <Td className="whitespace-nowrap text-texto-suave tabular-nums">
              {formatarData(usuario.createdAt)}
            </Td>
            {podeGerir && (
              <Td className="whitespace-nowrap">
                <div className="flex justify-end">
                  {podeAgirSobre(usuario) ? (
                    acoes(usuario)
                  ) : (
                    <span className="text-sm text-texto-suave">Você</span>
                  )}
                </div>
              </Td>
            )}
          </Linha>
        ))}
      </Tabela>
    </>
  );
}
