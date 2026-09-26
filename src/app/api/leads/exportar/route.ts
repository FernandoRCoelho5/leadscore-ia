import { db } from "@/db";
import { formatarDataHora } from "@/lib/datas";
import { ErroNaoAutenticado, ErroNaoEncontrado } from "@/lib/erros";
import {
  ROTULO_DA_ANALISE,
  ROTULO_DA_CLASSIFICACAO,
  ROTULO_DA_ORIGEM,
  ROTULO_DO_STATUS,
} from "@/lib/rotulos";
import {
  esquemaFiltrosDeLeads,
  filtrosDoRepositorio,
  normalizarParametros,
} from "@/lib/validacao/filtros";
import { contextoDa, obterSessao } from "@/server/auth/sessao";
import { respostaCsv } from "@/server/http/csv";
import { comTratamentoDeErros } from "@/server/http/responder";
import { exportarLeadsDaEmpresa } from "@/server/services/leads";

/**
 * Exporta em CSV os leads da empresa ativa, com os mesmos filtros da lista
 * (D-029). Permissão `leads:exportar` (cliente e admin; o suporte não) e
 * registro na auditoria. A empresa vem da sessão, nunca da URL.
 */
export const GET = comTratamentoDeErros(async (request) => {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new ErroNaoAutenticado();
  }
  if (!sessao.empresaAtiva) {
    throw new ErroNaoEncontrado("Nenhuma empresa selecionada.");
  }
  const filtros = esquemaFiltrosDeLeads.parse(
    normalizarParametros(Object.fromEntries(request.nextUrl.searchParams)),
  );
  const lotes = await exportarLeadsDaEmpresa(
    db,
    contextoDa(sessao),
    sessao.empresaAtiva.empresaId,
    filtrosDoRepositorio(filtros),
  );

  return respostaCsv({
    prefixoDoArquivo: "leads",
    cabecalho: [
      "Nome",
      "E-mail",
      "Telefone",
      "Empresa",
      "Segmento",
      "Mensagem",
      "Classificação",
      "Nota",
      "Análise",
      "Andamento",
      "Origem",
      "Recebido em",
      "Consentimento em",
    ],
    lotes,
    linha: (lead) => [
      lead.nome,
      lead.email,
      lead.telefone,
      lead.empresaNome,
      lead.segmento,
      lead.mensagem,
      lead.classificacaoAtual ? ROTULO_DA_CLASSIFICACAO[lead.classificacaoAtual] : "",
      lead.scoreAtual,
      ROTULO_DA_ANALISE[lead.statusAnalise],
      ROTULO_DO_STATUS[lead.status],
      ROTULO_DA_ORIGEM[lead.origem],
      formatarDataHora(lead.createdAt),
      lead.consentimentoEm ? formatarDataHora(lead.consentimentoEm) : "",
    ],
  });
});
