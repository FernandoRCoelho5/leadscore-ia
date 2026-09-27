import { Avatar } from "@/components/ui/Avisos";
import { SeloDeSituacao } from "@/components/ui/Selos";
import { formatarData } from "@/lib/datas";
import { enderecoDaFoto } from "@/server/armazenamento/fotos";
import type { ConviteNaLista, MembroNaLista } from "@/server/repositories/membros";

import { CancelarConvite, RemoverMembro } from "./AcoesDosMembros";

/**
 * Pessoas da empresa e convites pendentes. Listas curtas e de uma coluna
 * principal: a mesma marcação serve para o celular e o computador.
 */

export function ListaDeMembros({
  membros,
  usuarioAtualId,
  podeGerir,
}: {
  membros: MembroNaLista[];
  /** Quem está vendo: não remove a si mesmo. */
  usuarioAtualId: string;
  podeGerir: boolean;
}) {
  return (
    <ul className="divide-y divide-borda rounded-lg border border-borda bg-superficie">
      {membros.map((membro) => (
        <li key={membro.usuarioId} className="flex flex-wrap items-center gap-3 p-4">
          <Avatar nome={membro.nome} fotoUrl={enderecoDaFoto(membro.usuarioId, membro.imagemUrl)} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {membro.nome}
              {membro.usuarioId === usuarioAtualId && (
                <span className="font-normal text-texto-suave"> (você)</span>
              )}
            </p>
            <p className="truncate text-sm text-texto-suave">{membro.email}</p>
            <p className="text-xs text-texto-suave">
              Na empresa desde {formatarData(membro.desde)}
            </p>
          </div>
          {membro.bloqueado && <SeloDeSituacao bloqueado rotulo="Conta bloqueada" />}
          {podeGerir && membro.usuarioId !== usuarioAtualId && (
            <RemoverMembro usuarioId={membro.usuarioId} nome={membro.nome} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function ListaDeConvites({
  convites,
  podeGerir,
}: {
  convites: ConviteNaLista[];
  podeGerir: boolean;
}) {
  return (
    <ul className="divide-y divide-borda rounded-lg border border-borda bg-superficie">
      {convites.map((convite) => (
        <li key={convite.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{convite.email}</p>
            <p className="text-sm text-texto-suave">
              Vale até {formatarData(convite.expiraEm)}
              {convite.criadoPorNome && ` · convidado por ${convite.criadoPorNome}`}
            </p>
          </div>
          {podeGerir && <CancelarConvite conviteId={convite.id} email={convite.email} />}
        </li>
      ))}
    </ul>
  );
}
