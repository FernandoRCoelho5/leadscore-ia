import "server-only";

import type { BancoDeDados } from "@/db/tipos";
import { ErroLimiteExcedido, ErroNaoEncontrado, ErroValidacao } from "@/lib/erros";
import { logger } from "@/lib/logger";
import { SLUG_MAXIMO } from "@/lib/validacao/empresa";
import {
  CAMPO_ARMADILHA,
  CAMPO_CARIMBO,
  VERSAO_DO_CONSENTIMENTO,
  esquemaLeadPublico,
} from "@/lib/validacao/lead";
import { obterEmpresaAtivaPorSlug } from "@/server/repositories/empresas";
import { criarLead } from "@/server/repositories/leads";
import { criarCarimbo, lerCarimbo } from "@/server/seguranca/carimbo";
import { hashDoIp } from "@/server/seguranca/ip";
import type { LimitadorDeTaxa, RegraDeLimite } from "@/server/seguranca/limitador";

/** Captação de leads pelo formulário público `/f/[slug]` (D-009 e D-028). */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** Abaixo disso, ninguém preenche o formulário: é robô. */
export const TEMPO_MINIMO_DE_PREENCHIMENTO_MS = 3_000;
/** Depois disso, o carimbo expira e a página precisa ser recarregada. */
export const VALIDADE_DO_CARIMBO_MS = 24 * HORA;

/** Limites de envio (D-028). */
export const LIMITES_DA_CAPTACAO = {
  /** Um visitante num formulário. */
  porIpNoFormulario: { limite: 5, janelaMs: 10 * MINUTO },
  /** Um visitante em todos os formulários (quem varre vários clientes). */
  porIp: { limite: 20, janelaMs: HORA },
  /** Um formulário, somando todos os visitantes. */
  porFormulario: { limite: 300, janelaMs: HORA },
} as const;

const FORMATO_SLUG = /^[a-z0-9-]+$/;

async function empresaDoFormulario(db: BancoDeDados, slug: string) {
  const empresa =
    slug.length <= SLUG_MAXIMO && FORMATO_SLUG.test(slug)
      ? await obterEmpresaAtivaPorSlug(db, slug)
      : undefined;
  if (!empresa) {
    throw new ErroNaoEncontrado("Formulário não encontrado.");
  }
  return empresa;
}

export type FormularioPublico = { nomeDaEmpresa: string; carimbo: string };

/** Dados para montar a página do formulário: só o nome da empresa e o carimbo. */
export async function obterFormularioPublico(
  db: BancoDeDados,
  slug: string,
  agora: Date = new Date(),
): Promise<FormularioPublico> {
  const empresa = await empresaDoFormulario(db, slug);
  return { nomeDaEmpresa: empresa.nome, carimbo: criarCarimbo(empresa.id, agora) };
}

export type ResultadoDaCaptacao =
  | { situacao: "recebido"; leadId: string }
  /** Robô: responde como se tivesse recebido, para não ensinar o que foi detectado. */
  | { situacao: "descartado"; motivo: "armadilha" | "rapido_demais" };

export type EntradaDaCaptacao = {
  slug: string;
  /** Corpo JSON enviado pelo formulário (valores em texto, como no HTML). */
  corpo: unknown;
  /** IP do visitante, ou null se a hospedagem não informar. */
  ip: string | null;
  agora?: Date;
};

export type DependenciasDaCaptacao = {
  limitador: LimitadorDeTaxa;
  /** Agenda a análise da IA sem fazer o visitante esperar (D-007). */
  agendarAnalise: (empresaId: string, leadId: string) => void;
};

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

async function aplicarLimite(
  limitador: LimitadorDeTaxa,
  regra: RegraDeLimite,
  agora: Date,
  mensagem: string,
): Promise<void> {
  const resultado = await limitador.consumir(regra, agora);
  if (!resultado.permitido) {
    throw new ErroLimiteExcedido(mensagem, resultado.tentarNovamenteEmSegundos);
  }
}

/**
 * Recebe um envio do formulário público:
 * 1. campo-armadilha preenchido: descarta em silêncio;
 * 2. valida os dados com o mesmo schema do navegador;
 * 3. confere a empresa (ativa) e o carimbo assinado da página; envio rápido
 *    demais é descartado em silêncio;
 * 4. aplica os limites por IP e por formulário (429 com Retry-After);
 * 5. grava o lead com o consentimento e o hash do IP;
 * 6. agenda a análise da IA para depois da resposta.
 * Nenhum dado pessoal vai para o log.
 */
export async function captarLead(
  db: BancoDeDados,
  { slug, corpo, ip, agora = new Date() }: EntradaDaCaptacao,
  { limitador, agendarAnalise }: DependenciasDaCaptacao,
): Promise<ResultadoDaCaptacao> {
  if (!ehObjeto(corpo)) {
    throw new ErroValidacao([], "Envie os dados do formulário.");
  }
  const armadilha = corpo[CAMPO_ARMADILHA];
  if (typeof armadilha === "string" && armadilha.trim() !== "") {
    logger.warn("Envio descartado pelo campo-armadilha", { slug });
    return { situacao: "descartado", motivo: "armadilha" };
  }

  const validacao = esquemaLeadPublico.safeParse(corpo);
  if (!validacao.success) {
    throw ErroValidacao.deZod(validacao.error);
  }
  const dados = validacao.data;

  const empresa = await empresaDoFormulario(db, slug);
  const carimbo = lerCarimbo(corpo[CAMPO_CARIMBO], empresa.id, agora);
  if (!carimbo.valido || carimbo.idadeMs > VALIDADE_DO_CARIMBO_MS) {
    throw new ErroValidacao(
      [],
      "O formulário expirou. Recarregue a página e envie de novo (copie a mensagem antes).",
    );
  }
  if (carimbo.idadeMs < TEMPO_MINIMO_DE_PREENCHIMENTO_MS) {
    logger.warn("Envio descartado por ser rápido demais", { empresaId: empresa.id });
    return { situacao: "descartado", motivo: "rapido_demais" };
  }

  // Sem IP (hospedagem que não informa), todos dividem o mesmo contador.
  const ipHash = ip ? hashDoIp(ip) : null;
  const visitante = ipHash ?? "desconhecido";
  const muitosEnvios =
    "Você enviou muitas mensagens em pouco tempo. Aguarde alguns minutos e tente de novo.";
  await aplicarLimite(
    limitador,
    { chave: `captacao:ip:${visitante}`, ...LIMITES_DA_CAPTACAO.porIp },
    agora,
    muitosEnvios,
  );
  await aplicarLimite(
    limitador,
    { chave: `captacao:${empresa.id}:ip:${visitante}`, ...LIMITES_DA_CAPTACAO.porIpNoFormulario },
    agora,
    muitosEnvios,
  );
  // Por último: tentativas já barradas por IP não gastam o limite do formulário
  // (senão um único visitante abusivo bloquearia o formulário para todos).
  await aplicarLimite(
    limitador,
    { chave: `captacao:${empresa.id}`, ...LIMITES_DA_CAPTACAO.porFormulario },
    agora,
    "Este formulário recebeu muitas mensagens agora. Tente de novo mais tarde.",
  );

  const lead = await criarLead(db, empresa.id, {
    nome: dados.nome,
    email: dados.email,
    telefone: dados.telefone,
    empresaNome: dados.empresaNome,
    segmento: dados.segmento,
    mensagem: dados.mensagem,
    origem: "formulario",
    consentimentoLgpd: true,
    consentimentoEm: agora,
    consentimentoVersaoTexto: VERSAO_DO_CONSENTIMENTO,
    ipHash,
  });

  agendarAnalise(empresa.id, lead.id);
  logger.info("Lead captado pelo formulário", { leadId: lead.id, empresaId: empresa.id });
  return { situacao: "recebido", leadId: lead.id };
}
