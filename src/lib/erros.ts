import type { z } from "zod";

/**
 * Erros de domínio da aplicação.
 *
 * Os serviços lançam estes erros; a camada HTTP (src/server/http) os traduz
 * para o formato único de resposta. A `message` de um ErroApp é escrita para o
 * usuário final. Detalhes técnicos vão em `cause` e aparecem só no log.
 */

export const STATUS_POR_CODIGO = {
  VALIDACAO: 400,
  NAO_AUTENTICADO: 401,
  PROIBIDO: 403,
  NAO_ENCONTRADO: 404,
  CONFLITO: 409,
  LIMITE_EXCEDIDO: 429,
  INTERNO: 500,
} as const;

export type CodigoErro = keyof typeof STATUS_POR_CODIGO;

/** Problema num campo específico de um formulário ou corpo de requisição. */
export type DetalheDeCampo = { campo: string; mensagem: string };

type OpcoesDeErro = {
  detalhes?: readonly DetalheDeCampo[];
  causa?: unknown;
};

export class ErroApp extends Error {
  readonly codigo: CodigoErro;
  readonly detalhes: readonly DetalheDeCampo[] | undefined;

  constructor(codigo: CodigoErro, mensagem: string, opcoes: OpcoesDeErro = {}) {
    super(mensagem, { cause: opcoes.causa });
    this.name = new.target.name;
    this.codigo = codigo;
    this.detalhes = opcoes.detalhes;
  }

  get status(): number {
    return STATUS_POR_CODIGO[this.codigo];
  }
}

export class ErroValidacao extends ErroApp {
  constructor(
    detalhes: readonly DetalheDeCampo[],
    mensagem = "Dados inválidos. Confira os campos destacados.",
  ) {
    super("VALIDACAO", mensagem, { detalhes });
  }

  /** Converte um erro do Zod em ErroValidacao, campo a campo. */
  static deZod(erro: z.ZodError): ErroValidacao {
    return new ErroValidacao(
      erro.issues.map((issue) => ({
        campo: issue.path.map(String).join("."),
        mensagem: issue.message,
      })),
    );
  }
}

export class ErroNaoAutenticado extends ErroApp {
  constructor(mensagem = "Faça login para continuar.") {
    super("NAO_AUTENTICADO", mensagem);
  }
}

export class ErroProibido extends ErroApp {
  constructor(mensagem = "Você não tem permissão para esta ação.") {
    super("PROIBIDO", mensagem);
  }
}

/**
 * Também usado quando o recurso existe mas pertence a outra empresa:
 * responder 404 em vez de 403 não revela que o registro existe.
 */
export class ErroNaoEncontrado extends ErroApp {
  constructor(mensagem = "Recurso não encontrado.") {
    super("NAO_ENCONTRADO", mensagem);
  }
}

export class ErroConflito extends ErroApp {
  constructor(mensagem: string) {
    super("CONFLITO", mensagem);
  }
}

export class ErroLimiteExcedido extends ErroApp {
  /** Vira o cabeçalho HTTP `Retry-After`. */
  readonly tentarNovamenteEmSegundos: number | undefined;

  constructor(
    mensagem = "Muitas tentativas. Aguarde um pouco e tente novamente.",
    tentarNovamenteEmSegundos?: number,
  ) {
    super("LIMITE_EXCEDIDO", mensagem);
    this.tentarNovamenteEmSegundos = tentarNovamenteEmSegundos;
  }
}
