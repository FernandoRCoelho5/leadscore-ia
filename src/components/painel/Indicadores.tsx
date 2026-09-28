import { CircleAlert, CircleDashed, Flame, Snowflake, Thermometer } from "lucide-react";
import type { ReactNode } from "react";

import type { Classificacao, StatusLead } from "@/db/schema";
import { ROTULO_DO_STATUS, STATUS_DO_LEAD } from "@/lib/rotulos";

/**
 * Indicadores da visão geral, só com HTML e CSS (D-029, skill dataviz):
 * - números soltos viram blocos de indicador (rótulo + valor), não gráficos;
 * - partes de um todo viram barras horizontais com rótulo, valor e
 *   percentual sempre escritos: a leitura nunca depende só da cor;
 * - as cores térmicas (`*-grafico`) marcam só a classificação; o andamento
 *   usa uma cor neutra única.
 */

const numero = (valor: number) => valor.toLocaleString("pt-BR");
const percentual = (parte: number, total: number) =>
  total === 0 ? 0 : Math.round((parte / total) * 100);

export function BlocoDeIndicador({
  rotulo,
  valor,
  detalhe,
  children,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-borda bg-superficie p-5">
      <dt className="text-sm text-texto-suave">{rotulo}</dt>
      <dd className="text-3xl leading-tight font-bold tabular-nums">{valor}</dd>
      {detalhe && <dd className="text-sm text-texto-suave">{detalhe}</dd>}
      {children}
    </div>
  );
}

/** Análises usadas no mês contra o limite do plano. */
export function MedidorDeConsumo({ usadas, limite }: { usadas: number; limite: number }) {
  const uso = limite === 0 ? 100 : Math.min(100, percentual(usadas, limite));
  const esgotado = usadas >= limite;
  return (
    <dd className="mt-2 flex flex-col gap-2">
      <div
        role="meter"
        aria-label="Análises usadas no mês"
        aria-valuemin={0}
        aria-valuemax={limite}
        aria-valuenow={Math.min(usadas, limite)}
        aria-valuetext={`${usadas} de ${limite} análises`}
        className="h-2 overflow-hidden rounded-full bg-superficie-2"
      >
        <div
          className={`h-full rounded-r ${esgotado ? "bg-erro" : "bg-texto-suave"}`}
          style={{ width: `${uso}%` }}
        />
      </div>
      {esgotado ? (
        <p className="flex items-start gap-1.5 text-sm text-erro">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Limite atingido: novos leads chegam sem análise até o mês virar.
        </p>
      ) : (
        uso >= 80 && <p className="text-sm text-texto-suave">Perto do limite ({uso}% usado).</p>
      )}
    </dd>
  );
}

type LinhaDaBarra = {
  chave: string;
  rotulo: string;
  icone?: ReactNode;
  valor: number;
  /** Classes do preenchimento (cor ou textura). */
  preenchimento: string;
};

function Barras({
  linhas,
  total,
  titulo,
}: {
  linhas: LinhaDaBarra[];
  total: number;
  titulo: string;
}) {
  return (
    <ul aria-label={titulo} className="flex flex-col gap-3">
      {linhas.map((linha) => {
        const parte = percentual(linha.valor, total);
        return (
          <li
            key={linha.chave}
            className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm"
          >
            <span className="flex items-center gap-1.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-texto-suave">
              {linha.icone}
              {linha.rotulo}
            </span>
            {/* A barra é decorativa: o valor e o percentual estão escritos ao lado. */}
            <span aria-hidden="true" className="h-3 overflow-hidden rounded-r bg-superficie-2">
              <span
                className={`block h-full rounded-r ${linha.preenchimento}`}
                style={{ width: `${linha.valor > 0 ? Math.max(2, parte) : 0}%` }}
              />
            </span>
            <span className="w-20 text-right tabular-nums">
              <span className="font-semibold">{numero(linha.valor)}</span>{" "}
              <span className="text-texto-suave">({parte}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Textura para "sem análise": não confunde com o azul-acinzentado do frio. */
const TEXTURA =
  "bg-[repeating-linear-gradient(45deg,var(--color-borda-campo)_0_2px,transparent_2px_6px)]";

export function BarrasDeClassificacao({
  contagem,
  total,
}: {
  contagem: Record<Classificacao | "semAnalise", number>;
  total: number;
}) {
  return (
    <Barras
      titulo="Leads do mês por classificação"
      total={total}
      linhas={[
        {
          chave: "quente",
          rotulo: "Quentes",
          icone: <Flame aria-hidden="true" />,
          valor: contagem.quente,
          preenchimento: "bg-quente-grafico",
        },
        {
          chave: "morno",
          rotulo: "Mornos",
          icone: <Thermometer aria-hidden="true" />,
          valor: contagem.morno,
          // O âmbar sozinho tem pouco contraste com o fundo: contorno escuro (D-029).
          preenchimento: "bg-morno-grafico ring-1 ring-inset ring-morno-grafico-contorno",
        },
        {
          chave: "frio",
          rotulo: "Frios",
          icone: <Snowflake aria-hidden="true" />,
          valor: contagem.frio,
          preenchimento: "bg-frio-grafico",
        },
        {
          chave: "semAnalise",
          rotulo: "Sem análise",
          icone: <CircleDashed aria-hidden="true" />,
          valor: contagem.semAnalise,
          preenchimento: TEXTURA,
        },
      ]}
    />
  );
}

export function BarrasDeAndamento({
  contagem,
  total,
}: {
  contagem: Record<StatusLead, number>;
  total: number;
}) {
  return (
    <Barras
      titulo="Leads por andamento"
      total={total}
      linhas={STATUS_DO_LEAD.map((status) => ({
        chave: status,
        rotulo: ROTULO_DO_STATUS[status],
        valor: contagem[status],
        preenchimento: "bg-texto-suave",
      }))}
    />
  );
}
