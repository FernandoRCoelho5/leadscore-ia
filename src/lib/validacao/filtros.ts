import { z } from "zod";

import { CODIGOS_DAS_ACOES } from "@/lib/auditoria";
import { fimDoDia, inicioDoDia } from "@/lib/datas";
import { TAMANHO_MAXIMO_PAGINA, TAMANHO_PADRAO_PAGINA } from "@/lib/paginacao";
import {
  CLASSIFICACOES,
  PAPEIS_DE_ACESSO,
  SITUACOES_DA_EMPRESA,
  SITUACOES_DO_USUARIO,
  STATUS_DO_LEAD,
} from "@/lib/rotulos";

/**
 * Filtros das listas, lidos da URL (D-029). A URL é editável por qualquer um:
 * um valor inválido é ignorado (volta ao padrão) em vez de quebrar a página.
 */

export type ParametrosDaUrl = Record<string, string | string[] | undefined>;

/** `?x=1&x=2` chega como lista; vale o primeiro valor. */
export function normalizarParametros(parametros: ParametrosDaUrl): Record<string, string> {
  const normalizados: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(parametros)) {
    const primeiro = Array.isArray(valor) ? valor[0] : valor;
    if (primeiro !== undefined) {
      normalizados[chave] = primeiro;
    }
  }
  return normalizados;
}

const opcional = <Esquema extends z.ZodType>(esquema: Esquema) =>
  esquema.optional().catch(undefined);

const busca = opcional(
  z
    .string()
    .trim()
    .max(100)
    .transform((valor) => valor || undefined),
);

const dia = opcional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const esquemaPaginacaoDaUrl = z.object({
  pagina: z.coerce.number().int().min(1).max(100_000).catch(1),
  porPagina: z.coerce.number().int().min(1).max(TAMANHO_MAXIMO_PAGINA).catch(TAMANHO_PADRAO_PAGINA),
});

export const esquemaFiltrosDeLeads = z
  .object({
    busca,
    classificacao: opcional(z.enum(CLASSIFICACOES)),
    status: opcional(z.enum(STATUS_DO_LEAD)),
    de: dia,
    ate: dia,
    ordem: opcional(z.enum(["recentes", "antigos", "maior-nota", "menor-nota", "nome"])),
  })
  .extend(esquemaPaginacaoDaUrl.shape);

export type FiltrosDaUrlDeLeads = z.output<typeof esquemaFiltrosDeLeads>;

/** Opções de ordem da lista, na ordem em que aparecem na tela. */
export const ORDENS_DE_LEADS = {
  recentes: { rotulo: "Mais recentes", ordenarPor: "criadoEm", direcao: "desc" },
  antigos: { rotulo: "Mais antigos", ordenarPor: "criadoEm", direcao: "asc" },
  "maior-nota": { rotulo: "Maior nota", ordenarPor: "score", direcao: "desc" },
  "menor-nota": { rotulo: "Menor nota", ordenarPor: "score", direcao: "asc" },
  nome: { rotulo: "Nome (A a Z)", ordenarPor: "nome", direcao: "asc" },
} as const;

/** Converte os filtros da URL nos filtros do repositório (datas no fuso de São Paulo). */
export function filtrosDoRepositorio(filtros: FiltrosDaUrlDeLeads) {
  const ordem = ORDENS_DE_LEADS[filtros.ordem ?? "recentes"];
  const { desde, ate } = periodo(filtros.de, filtros.ate);
  return {
    busca: filtros.busca,
    classificacao: filtros.classificacao,
    status: filtros.status,
    criadoDe: desde,
    criadoAte: ate,
    ordenarPor: ordem.ordenarPor,
    direcao: ordem.direcao,
  };
}

/**
 * Período "de/até" da URL em limites no fuso de São Paulo. "Até" inclui o dia
 * inteiro: o limite (exclusivo) é a meia-noite do dia seguinte.
 */
function periodo(de: string | undefined, ate: string | undefined) {
  return {
    desde: de ? inicioDoDia(de) : undefined,
    ate: ate ? fimDoDia(ate) : undefined,
  };
}

// Listas da administração (equipe Brasa).

export const esquemaFiltrosDeEmpresas = z
  .object({ busca, situacao: opcional(z.enum(SITUACOES_DA_EMPRESA)) })
  .extend(esquemaPaginacaoDaUrl.shape);

export type FiltrosDaUrlDeEmpresas = z.output<typeof esquemaFiltrosDeEmpresas>;

export const esquemaFiltrosDeUsuarios = z
  .object({
    busca,
    papel: opcional(z.enum(PAPEIS_DE_ACESSO)),
    situacao: opcional(z.enum(SITUACOES_DO_USUARIO)),
  })
  .extend(esquemaPaginacaoDaUrl.shape);

export type FiltrosDaUrlDeUsuarios = z.output<typeof esquemaFiltrosDeUsuarios>;

export const esquemaFiltrosDaAuditoria = z
  .object({ acao: opcional(z.enum(CODIGOS_DAS_ACOES)), de: dia, ate: dia })
  .extend(esquemaPaginacaoDaUrl.shape);

export type FiltrosDaUrlDaAuditoria = z.output<typeof esquemaFiltrosDaAuditoria>;

export function filtrosDaAuditoriaDoRepositorio(filtros: FiltrosDaUrlDaAuditoria) {
  return { acao: filtros.acao, ...periodo(filtros.de, filtros.ate) };
}

/**
 * Monta a URL de uma lista com os filtros atuais e as mudanças pedidas (ex.:
 * outra página). Valores vazios e padrões saem da URL, para ela ficar curta.
 */
export function urlComFiltros(
  caminho: string,
  atuais: Record<string, string | number | undefined>,
  mudancas: Record<string, string | number | undefined> = {},
): string {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries({ ...atuais, ...mudancas })) {
    if (valor === undefined || valor === "") {
      continue;
    }
    if (chave === "pagina" && Number(valor) === 1) {
      continue;
    }
    if (chave === "porPagina" && Number(valor) === TAMANHO_PADRAO_PAGINA) {
      continue;
    }
    parametros.set(chave, String(valor));
  }
  const consulta = parametros.toString();
  return consulta ? `${caminho}?${consulta}` : caminho;
}
