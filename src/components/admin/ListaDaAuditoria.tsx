import { Linha, Tabela, Td, Th } from "@/components/ui/Tabela";
import { resumirDetalhes, rotuloDaAcao } from "@/lib/auditoria";
import { formatarDataHora } from "@/lib/datas";
import type { EventoNaLista } from "@/server/repositories/auditoria";

/**
 * Eventos da auditoria da página atual, do mais recente para o mais antigo:
 * tabela nas telas largas e cartões no celular e no tablet (ver
 * ListaDeEmpresas). O código técnico da ação fica
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
      {/* Celular e tablet: cartões. */}
      <ul className="flex flex-col gap-2 xl:hidden">
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
                <p className="mt-2 break-words">
                  <span className="text-texto-suave">Empresa: </span>
                  {evento.empresaNome}
                </p>
              )}
              {detalhes && <p className="mt-1 break-words text-texto-suave">{detalhes}</p>}
            </li>
          );
        })}
      </ul>

      {/* Telas largas: tabela. */}
      <Tabela
        legenda="Eventos da auditoria"
        className="hidden xl:block"
        cabecalho={
          <>
            <Th className="w-40 whitespace-nowrap">Quando</Th>
            <Th>Ação</Th>
            <Th className="w-56">Quem</Th>
            <Th className="w-44">Empresa</Th>
            <Th className="w-48">Detalhes</Th>
          </>
        }
      >
        {eventos.map((evento) => (
          <Linha key={evento.id} className="align-top">
            <Td className="whitespace-nowrap text-texto-suave tabular-nums">
              {formatarDataHora(evento.createdAt)}
            </Td>
            <Td>
              <Acao evento={evento} />
            </Td>
            <Td>
              <Quem evento={evento} />
            </Td>
            <Td>
              {evento.empresaNome ? (
                <span className="block truncate">{evento.empresaNome}</span>
              ) : (
                <span className="text-texto-suave">Plataforma</span>
              )}
            </Td>
            <Td className="break-words text-texto-suave">
              {resumirDetalhes(evento.detalhes) || "—"}
            </Td>
          </Linha>
        ))}
      </Tabela>
    </>
  );
}
