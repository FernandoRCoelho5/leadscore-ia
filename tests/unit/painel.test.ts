import { describe, expect, it } from "vitest";

import { BOM, celula, linhaCsv, nomeDoArquivo } from "@/lib/csv";
import { diaEmSaoPaulo, fimDoDia, formatarDataHora, inicioDoDia, inicioDoMes } from "@/lib/datas";
import {
  esquemaFiltrosDeLeads,
  filtrosDoRepositorio,
  normalizarParametros,
  urlComFiltros,
} from "@/lib/validacao/filtros";

describe("CSV", () => {
  it("separa por ponto e vírgula e termina a linha com CRLF", () => {
    expect(linhaCsv(["Maria", 85, null, true])).toBe("Maria;85;;true\r\n");
    expect(BOM).toBe("﻿");
  });

  it("põe entre aspas o que tem separador, aspas ou quebra de linha", () => {
    expect(celula("a;b")).toBe('"a;b"');
    expect(celula('diz "oi"')).toBe('"diz ""oi"""');
    expect(celula("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
  });

  it.each(["=HYPERLINK(1)", "+5511", "-1+1", "@SUM(A1)", "\t=1"])(
    "neutraliza fórmula no texto %j (CSV injection)",
    (texto) => {
      expect(celula(texto).replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("números negativos continuam números", () => {
    expect(celula(-5)).toBe("-5");
  });

  it("nome do arquivo leva a data", () => {
    expect(nomeDoArquivo("leads", new Date("2026-09-26T12:00:00Z"))).toBe("leads-2026-09-26.csv");
  });
});

describe("datas em São Paulo", () => {
  it("o dia começa à meia-noite de Brasília (03:00 UTC)", () => {
    expect(inicioDoDia("2026-09-26").toISOString()).toBe("2026-09-26T03:00:00.000Z");
    expect(fimDoDia("2026-09-26").toISOString()).toBe("2026-09-27T03:00:00.000Z");
  });

  it("às 22h de Brasília do dia 30, ainda é o mesmo mês (mesmo já sendo dia 1 em UTC)", () => {
    const noite = new Date("2026-10-01T01:00:00.000Z");

    expect(diaEmSaoPaulo(noite)).toBe("2026-09-30");
    expect(inicioDoMes(noite).toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(formatarDataHora(noite)).toBe("30/09/2026, 22:00");
  });
});

describe("filtros da URL", () => {
  it("ignora valores inválidos em vez de quebrar a página", () => {
    const filtros = esquemaFiltrosDeLeads.parse(
      normalizarParametros({
        classificacao: "fervendo",
        status: ["ganho", "perdido"],
        de: "ontem",
        pagina: "-3",
        porPagina: "5000",
        busca: "  maria  ",
      }),
    );

    expect(filtros).toMatchObject({
      classificacao: undefined,
      status: "ganho",
      de: undefined,
      pagina: 1,
      porPagina: 20,
      busca: "maria",
    });
  });

  it("converte o período em limites no fuso de São Paulo, com o último dia inteiro", () => {
    const filtros = esquemaFiltrosDeLeads.parse({ de: "2026-09-01", ate: "2026-09-30" });

    const doRepositorio = filtrosDoRepositorio(filtros);

    expect(doRepositorio.criadoDe?.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(doRepositorio.criadoAte?.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("monta a URL só com o que não é padrão", () => {
    const atuais = { busca: "ana", classificacao: undefined, pagina: 3, porPagina: 20 };

    expect(urlComFiltros("/leads", atuais)).toBe("/leads?busca=ana&pagina=3");
    expect(urlComFiltros("/leads", atuais, { pagina: 1 })).toBe("/leads?busca=ana");
    expect(urlComFiltros("/leads", {}, {})).toBe("/leads");
  });
});
