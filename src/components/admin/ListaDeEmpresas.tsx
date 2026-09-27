import { CircleAlert, LogIn } from "lucide-react";

import { abrirEmpresaAcao } from "@/app/acoes";
import { classesDeBotao } from "@/components/ui/Botao";
import { SeloDeSituacao } from "@/components/ui/Selos";
import { formatarData } from "@/lib/datas";
import { ROTULO_DA_SITUACAO_DA_EMPRESA } from "@/lib/rotulos";
import type { EmpresaNaLista } from "@/server/repositories/empresas";

import { GerenciarEmpresa } from "./GerenciarEmpresa";

/**
 * Empresas clientes da página atual: tabela no computador e cartões no
 * celular (sem rolagem lateral). "Abrir" leva a equipe para dentro da empresa
 * (acesso auditado); "Gerenciar" (limite e bloqueio) é só do admin.
 */

function Situacao({ empresa }: { empresa: EmpresaNaLista }) {
  return (
    <SeloDeSituacao
      bloqueado={empresa.status === "bloqueada"}
      rotulo={ROTULO_DA_SITUACAO_DA_EMPRESA[empresa.status]}
    />
  );
}

function UsoDoMes({ empresa }: { empresa: EmpresaNaLista }) {
  const esgotado = empresa.analisesNoMes >= empresa.limiteAnalisesMes;
  return (
    <span className="inline-flex flex-col">
      <span className="tabular-nums">
        {empresa.analisesNoMes.toLocaleString("pt-BR")} de{" "}
        {empresa.limiteAnalisesMes.toLocaleString("pt-BR")}
      </span>
      {esgotado && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-erro">
          <CircleAlert aria-hidden="true" className="size-3.5" />
          Limite atingido
        </span>
      )}
    </span>
  );
}

function Acoes({
  empresa,
  aberta,
  podeAdministrar,
  emLinha = false,
}: {
  empresa: EmpresaNaLista;
  aberta: boolean;
  podeAdministrar: boolean;
  /** Na tabela, os botões ficam lado a lado (sem quebrar a linha). */
  emLinha?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${emLinha ? "flex-nowrap justify-end" : "flex-wrap"}`}>
      {aberta ? (
        <span className="inline-flex h-controle items-center px-3 text-sm font-medium text-texto-suave">
          Aberta agora
        </span>
      ) : (
        <form action={abrirEmpresaAcao}>
          <input type="hidden" name="empresaId" value={empresa.id} />
          <button type="submit" className={classesDeBotao("contorno")}>
            <LogIn aria-hidden="true" className="size-4" />
            Abrir
            <span className="sr-only"> {empresa.nome}</span>
          </button>
        </form>
      )}
      {podeAdministrar && (
        <GerenciarEmpresa
          empresa={{
            id: empresa.id,
            nome: empresa.nome,
            status: empresa.status,
            limiteAnalisesMes: empresa.limiteAnalisesMes,
            analisesNoMes: empresa.analisesNoMes,
          }}
        />
      )}
    </div>
  );
}

export function ListaDeEmpresas({
  empresas,
  empresaAbertaId,
  podeAdministrar,
}: {
  empresas: EmpresaNaLista[];
  /** Empresa que a equipe está acessando agora, se houver. */
  empresaAbertaId?: string;
  podeAdministrar: boolean;
}) {
  return (
    <>
      {/* Celular: cartões. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {empresas.map((empresa) => (
          <li key={empresa.id} className="rounded-lg border border-borda bg-superficie p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{empresa.nome}</p>
                <p className="truncate text-sm text-texto-suave">/f/{empresa.slug}</p>
              </div>
              <Situacao empresa={empresa} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-texto-suave">Leads no mês</dt>
                <dd className="font-semibold tabular-nums">
                  {empresa.leadsNoMes.toLocaleString("pt-BR")}
                </dd>
              </div>
              <div>
                <dt className="text-texto-suave">Análises no mês</dt>
                <dd className="font-semibold">
                  <UsoDoMes empresa={empresa} />
                </dd>
              </div>
            </dl>
            <div className="mt-3">
              <Acoes
                empresa={empresa}
                aberta={empresa.id === empresaAbertaId}
                podeAdministrar={podeAdministrar}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Computador: tabela. */}
      <div className="hidden overflow-hidden rounded-lg border border-borda bg-superficie md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Empresas clientes</caption>
          <thead className="border-b border-borda bg-superficie-2 text-texto-suave">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Empresa
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Situação
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">
                Leads no mês
              </th>
              <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                Análises no mês
              </th>
              <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                Criada em
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {empresas.map((empresa) => (
              <tr key={empresa.id}>
                <td className="max-w-72 px-4 py-3">
                  <span className="block truncate font-semibold">{empresa.nome}</span>
                  <span className="block truncate text-texto-suave">/f/{empresa.slug}</span>
                </td>
                <td className="px-4 py-3">
                  <Situacao empresa={empresa} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {empresa.leadsNoMes.toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <UsoDoMes empresa={empresa} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-texto-suave tabular-nums">
                  {formatarData(empresa.createdAt)}
                </td>
                <td className="w-px px-4 py-3 whitespace-nowrap">
                  <Acoes
                    empresa={empresa}
                    aberta={empresa.id === empresaAbertaId}
                    podeAdministrar={podeAdministrar}
                    emLinha
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
