import "server-only";

import type { Empresa } from "@/db/schema";
import type { BancoDeDados } from "@/db/tipos";
import { ErroConflito, ErroNaoEncontrado, ErroProibido, ErroValidacao } from "@/lib/erros";
import type { DadosDoOnboarding, DadosDoPerfilDoNegocio } from "@/lib/validacao/empresa";
import { autorizar } from "@/server/auth/permissoes";
import { registrarAuditoria } from "@/server/repositories/auditoria";
import { atualizarPerfilDaEmpresa, criarEmpresa, slugEmUso } from "@/server/repositories/empresas";
import { criarVinculo } from "@/server/repositories/usuarios";

import { ehViolacaoDeUnicidade, type ContextoDoUsuario } from "./contexto";

/** Regras de negócio das empresas clientes. */

const erroSlugEmUso = () =>
  new ErroValidacao(
    [{ campo: "slug", mensagem: "Este endereço já está em uso. Escolha outro." }],
    "Este endereço já está em uso.",
  );

const paraCentavos = (reais: number | null) => (reais === null ? null : reais * 100);

/**
 * Onboarding: o cliente recém-cadastrado cria a empresa e vira membro dela.
 * Empresa, vínculo e auditoria são gravados na mesma transação.
 */
export async function criarEmpresaNoOnboarding(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  dados: DadosDoOnboarding,
): Promise<Empresa> {
  if (contexto.ator.papel !== "cliente") {
    throw new ErroProibido("Contas da equipe Brasa não criam empresas pelo onboarding.");
  }
  if (contexto.ator.empresaIds.length > 0) {
    throw new ErroConflito("Você já tem uma empresa cadastrada.");
  }
  if (await slugEmUso(db, dados.slug)) {
    throw erroSlugEmUso();
  }

  try {
    return await db.transaction(async (tx) => {
      const empresa = await criarEmpresa(tx, {
        nome: dados.nomeEmpresa,
        slug: dados.slug,
        descricao: dados.descricao,
        produtosServicos: dados.produtosServicos,
        clienteIdeal: dados.clienteIdeal,
        ticketMedioCentavos: paraCentavos(dados.ticketMedioReais),
        regioesAtendidas: dados.regioesAtendidas,
      });
      await criarVinculo(tx, contexto.usuarioId, empresa.id);
      await registrarAuditoria(tx, {
        atorId: contexto.usuarioId,
        empresaId: empresa.id,
        acao: "empresa.criada",
        recursoTipo: "empresa",
        recursoId: empresa.id,
      });
      return empresa;
    });
  } catch (erro) {
    // Duas pessoas escolhendo o mesmo endereço ao mesmo tempo: o índice único decide.
    if (ehViolacaoDeUnicidade(erro)) {
      throw erroSlugEmUso();
    }
    throw erro;
  }
}

/** Atualiza o perfil do negócio usado pela IA; cada edição gera uma nova versão do perfil. */
export async function atualizarPerfilDoNegocio(
  db: BancoDeDados,
  contexto: ContextoDoUsuario,
  empresaId: string,
  dados: DadosDoPerfilDoNegocio,
): Promise<Empresa> {
  autorizar(contexto.ator, "empresa:editar", empresaId);

  return db.transaction(async (tx) => {
    const empresa = await atualizarPerfilDaEmpresa(tx, empresaId, {
      descricao: dados.descricao,
      produtosServicos: dados.produtosServicos,
      clienteIdeal: dados.clienteIdeal,
      ticketMedioCentavos: paraCentavos(dados.ticketMedioReais),
      regioesAtendidas: dados.regioesAtendidas,
    });
    if (!empresa) {
      throw new ErroNaoEncontrado();
    }
    await registrarAuditoria(tx, {
      atorId: contexto.usuarioId,
      empresaId,
      acao: "empresa.perfil_atualizado",
      recursoTipo: "empresa",
      recursoId: empresaId,
      detalhes: { perfilVersao: empresa.perfilVersao },
    });
    return empresa;
  });
}
