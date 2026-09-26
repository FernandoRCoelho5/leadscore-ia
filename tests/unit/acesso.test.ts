import { describe, expect, it } from "vitest";

import { mensagemDoErroDeAutenticacao } from "@/lib/auth/erros";
import {
  destinoSeguro,
  esquemaCadastro,
  esquemaLogin,
  esquemaNovaSenha,
} from "@/lib/validacao/auth";
import { esquemaOnboarding, esquemaPerfilDoNegocio, gerarSlug } from "@/lib/validacao/empresa";
import { exigeLogin } from "@/proxy";
import { ehViolacaoDeUnicidade } from "@/server/services/contexto";

describe("destinoSeguro (proteção contra open redirect)", () => {
  it.each(["/painel", "/leads?pagina=2", "/configuracoes"])(
    "aceita o caminho interno %s",
    (destino) => {
      expect(destinoSeguro(destino)).toBe(destino);
    },
  );

  it("mantém a busca e o fragmento do destino interno", () => {
    expect(destinoSeguro("/leads?classificacao=quente#topo")).toBe(
      "/leads?classificacao=quente#topo",
    );
  });

  it.each([
    // TAB e quebra de linha: o navegador os remove e "/<TAB>/site" vira "//site".
    "/\t/site-falso.com",
    "/\n/site-falso.com",
    "/\\site-falso.com",
    "//site-falso.com",
    "https://site-falso.com",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ])("troca %s pelo painel", (destino) => {
    expect(destinoSeguro(destino)).toBe("/painel");
  });
});

describe("proxy: áreas que exigem login", () => {
  it.each(["/painel", "/leads/abc", "/admin/empresas", "/perfil", "/onboarding", "/configuracoes"])(
    "%s exige login",
    (caminho) => {
      expect(exigeLogin(caminho)).toBe(true);
    },
  );

  it.each(["/", "/login", "/cadastro", "/f/demo", "/painelzinho", "/leadsx"])(
    "%s é público",
    (caminho) => {
      expect(exigeLogin(caminho)).toBe(false);
    },
  );
});

describe("validações de conta", () => {
  it("exige senha de 10 a 128 caracteres no cadastro", () => {
    const base = { nome: "Ana", email: "ana@empresa.com.br" };
    expect(esquemaCadastro.safeParse({ ...base, senha: "123456789" }).success).toBe(false);
    expect(esquemaCadastro.safeParse({ ...base, senha: "1234567890" }).success).toBe(true);
    expect(esquemaCadastro.safeParse({ ...base, senha: "x".repeat(129) }).success).toBe(false);
  });

  it("normaliza o e-mail (espaços e maiúsculas)", () => {
    const resultado = esquemaLogin.parse({ email: "  Ana@Empresa.COM.br ", senha: "x" });
    expect(resultado.email).toBe("ana@empresa.com.br");
  });

  it("confere a repetição da nova senha", () => {
    const resultado = esquemaNovaSenha.safeParse({
      senha: "senha-boa-123",
      confirmacao: "outra-123",
    });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(["confirmacao"]);
  });
});

describe("validações da empresa", () => {
  it("gera o endereço a partir do nome, sem acentos nem símbolos", () => {
    expect(gerarSlug("Agência Pixel & Cia.")).toBe("agencia-pixel-cia");
    expect(gerarSlug("  Construção São João  ")).toBe("construcao-sao-joao");
    expect(gerarSlug("---")).toBe("");
  });

  it("recusa endereços fora do formato", () => {
    const base = {
      nomeEmpresa: "Empresa",
      descricao: "Descrição com mais de vinte caracteres.",
      clienteIdeal: "Cliente ideal com mais de vinte caracteres.",
      produtosServicos: "",
      ticketMedioReais: "",
      regioesAtendidas: "",
    };
    expect(esquemaOnboarding.safeParse({ ...base, slug: "minha-empresa" }).success).toBe(true);
    for (const slug of ["Maiuscula", "com espaco", "-inicio", "fim-", "a", "ç"]) {
      expect(esquemaOnboarding.safeParse({ ...base, slug }).success, slug).toBe(false);
    }
  });

  it("converte o ticket médio em reais e trata campos opcionais vazios como nulos", () => {
    const dados = esquemaPerfilDoNegocio.parse({
      descricao: "Descrição com mais de vinte caracteres.",
      clienteIdeal: "Cliente ideal com mais de vinte caracteres.",
      produtosServicos: "",
      ticketMedioReais: "4.500",
      regioesAtendidas: " ",
    });
    expect(dados.ticketMedioReais).toBe(4500);
    expect(dados.produtosServicos).toBeNull();
    expect(dados.regioesAtendidas).toBeNull();
  });

  it("recusa ticket médio que não é número", () => {
    const resultado = esquemaPerfilDoNegocio.safeParse({
      descricao: "Descrição com mais de vinte caracteres.",
      clienteIdeal: "Cliente ideal com mais de vinte caracteres.",
      produtosServicos: "",
      ticketMedioReais: "muito",
      regioesAtendidas: "",
    });
    expect(resultado.success).toBe(false);
  });
});

describe("mensagens de erro da autenticação", () => {
  it("traduz os códigos conhecidos", () => {
    expect(mensagemDoErroDeAutenticacao({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(mensagemDoErroDeAutenticacao({ code: "CONTA_BLOQUEADA", status: 403 })).toContain(
      "bloqueada",
    );
  });

  it("excesso de tentativas vira uma mensagem clara", () => {
    expect(mensagemDoErroDeAutenticacao({ status: 429 })).toContain("Muitas tentativas");
  });

  it("erro desconhecido não expõe detalhes técnicos", () => {
    const mensagem = mensagemDoErroDeAutenticacao({
      code: "ALGO_INTERNO",
      status: 500,
      message: "stack trace...",
    });
    expect(mensagem).toBe("Não foi possível concluir agora. Tente de novo.");
  });
});

describe("ehViolacaoDeUnicidade", () => {
  it("reconhece o código 23505 também dentro da causa do erro", () => {
    expect(ehViolacaoDeUnicidade({ code: "23505" })).toBe(true);
    expect(ehViolacaoDeUnicidade(new Error("falha", { cause: { code: "23505" } }))).toBe(true);
    expect(ehViolacaoDeUnicidade(new Error("outra"))).toBe(false);
  });
});
