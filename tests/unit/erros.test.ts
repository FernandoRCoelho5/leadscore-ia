import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ErroApp,
  ErroConflito,
  ErroLimiteExcedido,
  ErroNaoAutenticado,
  ErroNaoEncontrado,
  ErroProibido,
  ErroValidacao,
} from "@/lib/erros";

describe("erros de domínio", () => {
  it.each([
    [new ErroValidacao([]), "VALIDACAO", 400],
    [new ErroNaoAutenticado(), "NAO_AUTENTICADO", 401],
    [new ErroProibido(), "PROIBIDO", 403],
    [new ErroNaoEncontrado(), "NAO_ENCONTRADO", 404],
    [new ErroConflito("E-mail já cadastrado."), "CONFLITO", 409],
    [new ErroLimiteExcedido(), "LIMITE_EXCEDIDO", 429],
  ])("%s tem o código e o status HTTP corretos", (erro, codigo, status) => {
    expect(erro).toBeInstanceOf(ErroApp);
    expect(erro.codigo).toBe(codigo);
    expect(erro.status).toBe(status);
  });

  it("usa o nome da própria classe (útil nos logs)", () => {
    expect(new ErroProibido().name).toBe("ErroProibido");
  });

  it("guarda a causa técnica sem mudar a mensagem ao usuário", () => {
    const causa = new Error("timeout na conexão com o banco");
    const erro = new ErroApp("INTERNO", "Tente novamente.", { causa });

    expect(erro.message).toBe("Tente novamente.");
    expect(erro.cause).toBe(causa);
  });

  it("guarda o tempo de espera do limite excedido", () => {
    expect(new ErroLimiteExcedido(undefined, 30).tentarNovamenteEmSegundos).toBe(30);
  });

  it("converte erros do Zod em detalhes por campo", () => {
    const esquema = z.object({
      nome: z.string().min(2, "Informe o nome."),
      contato: z.object({ email: z.email("E-mail inválido.") }),
    });
    const resultado = esquema.safeParse({ nome: "A", contato: { email: "x" } });
    if (resultado.success) {
      expect.unreachable("a validação deveria falhar");
    }

    const erro = ErroValidacao.deZod(resultado.error);

    expect(erro.codigo).toBe("VALIDACAO");
    expect(erro.detalhes).toEqual([
      { campo: "nome", mensagem: "Informe o nome." },
      { campo: "contato.email", mensagem: "E-mail inválido." },
    ]);
  });
});
