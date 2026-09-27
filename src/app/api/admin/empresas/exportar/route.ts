import { db } from "@/db";
import { formatarDataHora } from "@/lib/datas";
import { ROTULO_DA_SITUACAO_DA_EMPRESA } from "@/lib/rotulos";
import { esquemaFiltrosDeEmpresas, normalizarParametros } from "@/lib/validacao/filtros";
import { contextoDa, exigirSessaoNaApi } from "@/server/auth/sessao";
import { respostaCsv } from "@/server/http/csv";
import { comTratamentoDeErros } from "@/server/http/responder";
import {
  listarEmpresasDaPlataforma,
  registrarExportacaoDaAdministracao,
  todasAsPaginas,
} from "@/server/services/administracao";

/**
 * Exporta em CSV a lista de empresas com os filtros da tela (D-029). Só a
 * equipe Brasa (`empresas:listar`); a exportação fica na auditoria.
 */
export const GET = comTratamentoDeErros(async (request) => {
  const contexto = contextoDa(await exigirSessaoNaApi());
  const { busca, situacao } = esquemaFiltrosDeEmpresas.parse(
    normalizarParametros(Object.fromEntries(request.nextUrl.searchParams)),
  );
  await registrarExportacaoDaAdministracao(db, contexto, "empresas", {
    comBusca: Boolean(busca),
    situacao: situacao ?? null,
  });
  // Um instante só para o arquivo todo: o "mês" não muda no meio da exportação.
  const agora = new Date();

  return respostaCsv({
    prefixoDoArquivo: "empresas",
    cabecalho: [
      "Empresa",
      "Endereço do formulário",
      "Situação",
      "Leads no mês",
      "Análises no mês",
      "Limite de análises por mês",
      "Criada em",
    ],
    lotes: todasAsPaginas((paginacao) =>
      listarEmpresasDaPlataforma(db, contexto, { busca, situacao }, paginacao, agora),
    ),
    linha: (empresa) => [
      empresa.nome,
      `/f/${empresa.slug}`,
      ROTULO_DA_SITUACAO_DA_EMPRESA[empresa.status],
      empresa.leadsNoMes,
      empresa.analisesNoMes,
      empresa.limiteAnalisesMes,
      formatarDataHora(empresa.createdAt),
    ],
  });
});
