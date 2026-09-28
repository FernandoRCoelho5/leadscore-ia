import { resumirDetalhes, rotuloDaAcao } from "@/lib/auditoria";
import { formatarDataHora } from "@/lib/datas";
import type { EventoNaLista } from "@/server/repositories/auditoria";

/**
 * Eventos da auditoria da página atual, do mais recente para o mais antigo:
 * tabela no computador e cartões no celular. O código técnico da ação fica
 * ao lado do texto, para quem cruza com os logs.
 */

function Quem({ evento }: { evento: EventoNaLista }) {
  if (!evento.atorNome) {
    return <span className="text-texto-suave">Sistema</span>;
  }
  return (
    <>
      <span className="block truncate font-medium">{evento.atorNome}</span>
      <span className="block truncate text-texto-suave">{evento.atorEmail}</span>
    </>
  );
}

function Acao({ evento }: { evento: EventoNaLista }) {
  return (
    <>
      <span className="block font-medium">{rotuloDaAcao(evento.acao)}</span>
      <code className="block text-xs text-texto-suave">{evento.acao}</code>
    </>
  );
}

export function ListaDaAuditoria({ eventos }: { eventos: EventoNaLista[] }) {
  return (
    <>
      {/* Celular: cartões. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {eventos.map((evento) => {
          const detalhes = resumirDetalhes(evento.detalhes);
          return (
            <li
              key={evento.id}
              className="rounded-lg border border-borda bg-superficie p-4 text-sm"
            >
              <p className="text-xs text-texto-suave tabular-nums">
                {formatarDataHora(evento.createdAt)}
              </p>
              <div className="mt-1">
                <Acao evento={evento} />
              </div>
              <div className="mt-2 min-w-0">
                <Quem evento={evento} />
              </div>
              {evento.empresaNome && (
                <p className="mt-2">
                  <span className="text-texto-suave">Empresa: </span>
                  {evento.empresaNome}
                </p>
              )}
              {detalhes && <p className="mt-1 break-words text-texto-suave">{detalhes}</p>}
            </li>
          );
        })}
      </ul>

      {/* Computador: tabela. */}
      <div className="hidden overflow-hidden rounded-lg border border-borda bg-superficie md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Eventos da auditoria</caption>
          <thead className="border-b border-borda bg-superficie-2 text-texto-suave">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                Quando
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Ação
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Quem
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Empresa
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Detalhes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {eventos.map((evento) => (
              <tr key={evento.id} className="align-top">
                <td className="px-4 py-3 whitespace-nowrap text-texto-suave tabular-nums">
                  {formatarDataHora(evento.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Acao evento={evento} />
                </td>
                <td className="max-w-56 px-4 py-3">
                  <Quem evento={evento} />
                </td>
                <td className="max-w-48 px-4 py-3">
                  {evento.empresaNome ? (
                    <span className="block truncate">{evento.empresaNome}</span>
                  ) : (
                    <span className="text-texto-suave">Plataforma</span>
                  )}
                </td>
                <td className="max-w-64 px-4 py-3 break-words text-texto-suave">
                  {resumirDetalhes(evento.detalhes) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
