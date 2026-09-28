import { describe, expect, it } from "vitest";

import {
  ACOES_DA_AUDITORIA,
  CODIGOS_DAS_ACOES,
  resumirDetalhes,
  rotuloDaAcao,
} from "@/lib/auditoria";
import { BOM, celula, linhaCsv, nomeDoArquivo } from "@/lib/csv";
import { diaEmSaoPaulo, fimDoDia, formatarDataHora, inicioDoDia, inicioDoMes } from "@/lib/datas";
import {
  esquemaFiltrosDaAuditoria,
  esquemaFiltrosDeEmpresas,
  esquemaFiltrosDeLeads,
  esquemaFiltrosDeUsuarios,
  filtrosDaAuditoriaDoRepositorio,
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

describe("filtros das listas da administração", () => {
  it("empresas e usuários: aceitam só as situações e os perfis conhecidos", () => {
    expect(
      esquemaFiltrosDeEmpresas.parse({ situacao: "bloqueada", busca: " agência " }),
    ).toMatchObject({ situacao: "bloqueada", busca: "agência" });
    expect(esquemaFiltrosDeEmpresas.parse({ situacao: "apagada" }).situacao).toBeUndefined();

    expect(esquemaFiltrosDeUsuarios.parse({ papel: "suporte", situacao: "ativo" })).toMatchObject({
      papel: "suporte",
      situacao: "ativo",
    });
    expect(esquemaFiltrosDeUsuarios.parse({ papel: "dono", situacao: "x" })).toMatchObject({
      papel: undefined,
      situacao: undefined,
    });
  });

  it("auditoria: só ações do catálogo; o período vira limites em São Paulo", () => {
    const filtros = esquemaFiltrosDaAuditoria.parse({
      acao: "lead.anonimizado",
      de: "2026-09-10",
      ate: "2026-09-10",
    });

    expect(filtrosDaAuditoriaDoRepositorio(filtros)).toEqual({
      acao: "lead.anonimizado",
      desde: new Date("2026-09-10T03:00:00.000Z"),
      ate: new Date("2026-09-11T03:00:00.000Z"),
    });
    // Texto livre na ação não chega ao banco.
    expect(esquemaFiltrosDaAuditoria.parse({ acao: "'; drop table x; --" }).acao).toBeUndefined();
  });
});

describe("catálogo da auditoria", () => {
  it("toda ação tem grupo e texto, sem repetir o texto", () => {
    const rotulos = CODIGOS_DAS_ACOES.map((codigo) => ACOES_DA_AUDITORIA[codigo].rotulo);

    expect(CODIGOS_DAS_ACOES.length).toBeGreaterThan(0);
    expect(new Set(rotulos).size).toBe(rotulos.length);
    expect(CODIGOS_DAS_ACOES.every((codigo) => ACOES_DA_AUDITORIA[codigo].grupo)).toBe(true);
  });

  it("mostra o texto da ação; um código fora do catálogo aparece como foi gravado", () => {
    expect(rotuloDaAcao("lead.excluido")).toBe("Excluiu um lead");
    expect(rotuloDaAcao("acao.antiga")).toBe("acao.antiga");
    // Nomes herdados de Object não contam como ação do catálogo.
    expect(rotuloDaAcao("toString")).toBe("toString");
  });

  it("resume os detalhes em uma linha, sem campos vazios", () => {
    expect(resumirDetalhes({ de: 100, para: 250, motivo: null, vazio: "" })).toBe(
      "de: 100 · para: 250",
    );
    expect(resumirDetalhes({ campos: ["nome"] })).toBe('campos: ["nome"]');
    expect(resumirDetalhes({})).toBe("");
  });
});
