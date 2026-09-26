import "server-only";

import type { Classificacao, Empresa, Lead } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { ErroConflito, ErroNaoEncontrado } from "@/lib/erros";
import { logger } from "@/lib/logger";
import {
  ErroDaIA,
  type MotivoDaFalha,
  type MotorDeAnalise,
  type ResultadoDoMotor,
} from "@/server/ia/motor";
import { VERSAO_DO_PROMPT, type EntradaDaAnalise } from "@/server/ia/prompt";
import { classificacaoDaNota } from "@/server/ia/schema";
import { autorizar } from "@/server/auth/permissoes";
import { registrarAnalise } from "@/server/repositories/analises";
import { registrarAuditoria } from "@/server/repositories/auditoria";
import { obterEmpresa } from "@/server/repositories/empresas";
import {
  atualizarStatusDaAnalise,
  obterLead,
  reservarLeadParaAnalise,
} from "@/server/repositories/leads";
import {
  competenciaDe,
  consumirAnalise,
  devolverAnalise,
  registrarTokens,
} from "@/server/repositories/usoMensal";

import type { ContextoDoUsuario } from "./contexto";

/** Análise de um lead pela IA (D-007, D-008 e D-027). */

export type ResultadoDaAnaliseDoLead =
  | { situacao: "concluida"; score: number; classificacao: Classificacao }
  | { situacao: "limite_atingido" }
  | { situacao: "em_andamento" }
  | { situacao: "falhou"; motivo: MotivoDaFalha | "erro_interno" };

/** O que vai para a IA. Minimização (LGPD): sem nome, e-mail nem telefone do lead. */
function entradaDaAnalise(empresa: Empresa, lead: Lead): EntradaDaAnalise {
  return {
    perfil: {
      nomeEmpresa: empresa.nome,
      descricao: empresa.descricao,
      produtosServicos: empresa.produtosServicos,
      clienteIdeal: empresa.clienteIdeal,
      ticketMedioCentavos: empresa.ticketMedioCentavos,
      regioesAtendidas: empresa.regioesAtendidas,
    },
    lead: {
      empresaNome: lead.empresaNome,
      segmento: lead.segmento,
      mensagem: lead.mensagem,
      origem: lead.origem,
    },
  };
}

/**
 * Analisa um lead e grava o resultado:
 * 1. reserva o lead (`processando`) numa única instrução, contra análises duplicadas;
 * 2. consome o limite mensal de forma atômica (sem saldo: `limite_atingido`);
 * 3. chama o motor (Claude API ou simulado);
 * 4. grava a análise, a cópia no lead e os tokens numa transação.
 * Se a IA falhar, a análise consumida é devolvida e o lead fica `falhou`,
 * pronto para reanálise. Nenhum dado pessoal vai para o log.
 */
export async function analisarLead(
  db: BancoDeDados,
  motor: MotorDeAnalise,
  empresaId: string,
  leadId: string,
  opcoes: { solicitadaPor?: string } = {},
): Promise<ResultadoDaAnaliseDoLead> {
  const existente = await obterLead(db, empresaId, leadId);
  if (!existente) {
    throw new ErroNaoEncontrado("Lead não encontrado.");
  }
  if (existente.anonimizadoEm) {
    throw new ErroConflito("Este lead foi anonimizado e não pode ser analisado.");
  }
  const empresa = await obterEmpresa(db, empresaId);
  if (!empresa) {
    throw new ErroNaoEncontrado("Empresa não encontrada.");
  }

  const lead = await reservarLeadParaAnalise(db, empresaId, leadId);
  if (!lead) {
    return { situacao: "em_andamento" };
  }

  const competencia = competenciaDe(new Date());
  if (!(await consumirAnalise(db, empresaId, empresa.limiteAnalisesMes, competencia))) {
    await atualizarStatusDaAnalise(db, empresaId, leadId, "limite_atingido");
    return { situacao: "limite_atingido" };
  }

  const inicio = performance.now();
  let resultado: ResultadoDoMotor;
  try {
    resultado = await motor.analisar(entradaDaAnalise(empresa, lead));
  } catch (erro) {
    const motivo = erro instanceof ErroDaIA ? erro.motivo : "erro_interno";
    const tokens = erro instanceof ErroDaIA ? erro.tokens : { entrada: 0, saida: 0 };
    await db.transaction(async (tx) => {
      await devolverAnalise(tx, empresaId, competencia);
      // Tokens cobrados mesmo sem resultado continuam no controle de custo.
      if (tokens.entrada + tokens.saida > 0) {
        await registrarTokens(tx, empresaId, tokens, competencia);
      }
      await atualizarStatusDaAnalise(tx, empresaId, leadId, "falhou");
    });
    logger.error("Falha na análise do lead", { leadId, empresaId, motivo, erro });
    return { situacao: "falhou", motivo };
  }

  const { resposta, tokens } = resultado;
  const classificacao = classificacaoDaNota(resposta.score);
  const salva = await db.transaction(async (tx) => {
    const analise = await registrarAnalise(tx, empresaId, leadId, {
      score: resposta.score,
      classificacao,
      justificativa: resposta.justificativa,
      respostaSugerida: resposta.respostaSugerida,
      modelo: resultado.modelo,
      promptVersion: VERSAO_DO_PROMPT,
      perfilVersao: empresa.perfilVersao,
      tokensEntrada: tokens.entrada,
      tokensSaida: tokens.saida,
      tempoRespostaMs: Math.round(performance.now() - inicio),
      tentativas: resultado.tentativas,
      mock: resultado.mock,
      solicitadaPor: opcoes.solicitadaPor ?? null,
    });
    if (!analise) {
      return false;
    }
    if (tokens.entrada + tokens.saida > 0) {
      await registrarTokens(tx, empresaId, tokens, competencia);
    }
    if (opcoes.solicitadaPor) {
      // Sem a nota nem o texto: a auditoria registra quem pediu, não o conteúdo.
      await registrarAuditoria(tx, {
        atorId: opcoes.solicitadaPor,
        empresaId,
        acao: "lead.reanalisado",
        recursoTipo: "lead",
        recursoId: leadId,
        detalhes: { analiseId: analise.id },
      });
    }
    return true;
  });

  if (!salva) {
    // O lead foi excluído durante a análise: a análise consumida é devolvida.
    await devolverAnalise(db, empresaId, competencia);
    throw new ErroNaoEncontrado("Lead não encontrado.");
  }

  logger.info("Lead analisado", {
    leadId,
    empresaId,
    classificacao,
    modelo: resultado.modelo,
    // "consumo" e não "tokens...": o logger oculta chaves que contêm "token".
    consumo: { entrada: tokens.entrada, saida: tokens.saida },
  });
  return { situacao: "concluida", score: resposta.score, classificacao };
}

/**
 * Reanálise pedida no painel. RBAC: quem pode editar leads daquela empresa
 * (cliente na própria empresa, admin em todas; o suporte não pode).
 */
export async function reanalisarLead(
  db: BancoDeDados,
  motor: MotorDeAnalise,
  contexto: ContextoDoUsuario,
  empresaId: string,
  leadId: string,
): Promise<ResultadoDaAnaliseDoLead> {
  autorizar(contexto.ator, "leads:editar", empresaId);
  return analisarLead(db, motor, empresaId, leadId, { solicitadaPor: contexto.usuarioId });
}
