import { CircleAlert, LogIn } from "lucide-react";

import { abrirEmpresaAcao } from "@/app/acoes";
import { classesDeBotao } from "@/components/ui/Botao";
import { SeloDeSituacao } from "@/components/ui/Selos";
import { Linha, Tabela, Td, Th } from "@/components/ui/Tabela";
import { formatarData } from "@/lib/datas";
import { ROTULO_DA_SITUACAO_DA_EMPRESA } from "@/lib/rotulos";
import type { EmpresaNaLista } from "@/server/repositories/empresas";

import { GerenciarEmpresa } from "./GerenciarEmpresa";

/**
 * Empresas clientes da página atual: tabela nas telas largas e cartões no
 * celular e no tablet (sem rolagem lateral; as seis colunas precisam de uns
 * 960 px, e com o menu lateral só as telas xl têm isso). "Abrir" leva a equipe
 * para dentro da empresa (acesso auditado); "Gerenciar" (limite e bloqueio) é
 * só do admin.
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
          Aberta
          <span className="sr-only"> agora</span>
        </span>
      ) : (
        <form action={abrirEmpresaAcao}>
          <input type="hidden" name="empresaId" value={empresa.id} />
          <button type="submit" className={classesDeBotao("contorno", true)}>
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
      {/* Celular e tablet: cartões (duas colunas no tablet). */}
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
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

      {/* Telas largas: tabela. */}
      <Tabela
        legenda="Empresas clientes"
        className="hidden xl:block"
        cabecalho={
          <>
            <Th>Empresa</Th>
            <Th className="w-32">Situação</Th>
            <Th className="w-32 text-right whitespace-nowrap">Leads no mês</Th>
            <Th className="w-36 whitespace-nowrap">Análises no mês</Th>
            <Th className="w-28 whitespace-nowrap">Criada em</Th>
            <Th className={podeAdministrar ? "w-64" : "w-32"}>
              <span className="sr-only">Ações</span>
            </Th>
          </>
        }
      >
        {empresas.map((empresa) => (
          <Linha key={empresa.id}>
            <Td>
              <span className="block truncate font-semibold">{empresa.nome}</span>
              <span className="block truncate text-texto-suave">/f/{empresa.slug}</span>
            </Td>
            <Td>
              <Situacao empresa={empresa} />
            </Td>
            <Td className="text-right tabular-nums">
              {empresa.leadsNoMes.toLocaleString("pt-BR")}
            </Td>
            <Td>
              <UsoDoMes empresa={empresa} />
            </Td>
            <Td className="whitespace-nowrap text-texto-suave tabular-nums">
              {formatarData(empresa.createdAt)}
            </Td>
            <Td className="whitespace-nowrap">
              <Acoes
                empresa={empresa}
                aberta={empresa.id === empresaAbertaId}
                podeAdministrar={podeAdministrar}
                emLinha
              />
            </Td>
          </Linha>
        ))}
      </Tabela>
    </>
  );
}
