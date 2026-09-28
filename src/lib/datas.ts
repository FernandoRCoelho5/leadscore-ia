/**
 * Datas do painel no fuso de São Paulo, qualquer que seja o fuso do servidor
 * (na Vercel, UTC). O Brasil não tem horário de verão desde 2019, então o
 * deslocamento é fixo em -03:00.
 */

const FUSO = "America/Sao_Paulo";
const DESLOCAMENTO = "-03:00";

const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, dateStyle: "short" });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  dateStyle: "short",
  timeStyle: "short",
});
const ANO_MES_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "26/09/2026" */
export function formatarData(data: Date): string {
  return DATA.format(data);
}

/** "26/09/2026, 14:05" */
export function formatarDataHora(data: Date): string {
  return DATA_HORA.format(data);
}

/** "2026-09-26", o dia em São Paulo (formato dos campos `type="date"`). */
export function diaEmSaoPaulo(data: Date): string {
  return ANO_MES_DIA.format(data);
}

/** Meia-noite (em São Paulo) do dia "AAAA-MM-DD". */
export function inicioDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00${DESLOCAMENTO}`);
}

/** Meia-noite do dia seguinte: limite exclusivo para "até este dia, inclusive". */
export function fimDoDia(dia: string): Date {
  const inicio = inicioDoDia(dia);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
}

/** Primeiro instante do mês (em São Paulo) da data informada. */
export function inicioDoMes(data: Date): Date {
  return inicioDoDia(`${diaEmSaoPaulo(data).slice(0, 7)}-01`);
}
