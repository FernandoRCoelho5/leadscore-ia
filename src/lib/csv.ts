/**
 * CSV para abrir direto no Excel brasileiro (D-029): ponto e vírgula como
 * separador (a vírgula é o separador decimal), BOM para o Excel reconhecer o
 * UTF-8 (acentos) e quebra de linha CRLF.
 */

export const SEPARADOR = ";";
/** Marca de ordem de bytes: sem ela, o Excel abre "Ã§" no lugar de "ç". */
export const BOM = "﻿";

export type ValorDeCelula = string | number | boolean | null | undefined;

/**
 * Textos que começam com estes caracteres viram fórmula no Excel ou no Google
 * Planilhas ("CSV injection"): um lead poderia escrever `=HYPERLINK(...)` no
 * nome. Esses textos ganham um apóstrofo na frente e ficam como texto.
 */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

export function celula(valor: ValorDeCelula): string {
  if (valor === null || valor === undefined) {
    return "";
  }
  let texto = String(valor);
  if (typeof valor === "string" && INICIO_DE_FORMULA.test(texto)) {
    texto = `'${texto}`;
  }
  // Aspas, separador ou quebra de linha: a célula vai entre aspas, com as aspas duplicadas.
  if (/[";\r\n]/.test(texto)) {
    texto = `"${texto.replaceAll('"', '""')}"`;
  }
  return texto;
}

export function linhaCsv(valores: readonly ValorDeCelula[]): string {
  return `${valores.map(celula).join(SEPARADOR)}\r\n`;
}

/** Nome de arquivo com a data, como "leads-2026-09-26.csv". */
export function nomeDoArquivo(prefixo: string, agora: Date = new Date()): string {
  return `${prefixo}-${agora.toISOString().slice(0, 10)}.csv`;
}
