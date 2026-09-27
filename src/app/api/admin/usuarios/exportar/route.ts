import { db } from "@/db";
import { formatarDataHora } from "@/lib/datas";
import { ROTULO_DA_SITUACAO_DO_USUARIO, ROTULO_DO_PAPEL } from "@/lib/rotulos";
import { esquemaFiltrosDeUsuarios, normalizarParametros } from "@/lib/validacao/filtros";
import { contextoDa, exigirSessaoNaApi } from "@/server/auth/sessao";
import { respostaCsv } from "@/server/http/csv";
import { comTratamentoDeErros } from "@/server/http/responder";
import {
  listarUsuariosDaPlataforma,
  registrarExportacaoDaAdministracao,
  todasAsPaginas,
} from "@/server/services/administracao";

/**
 * Exporta em CSV a lista de usuários com os filtros da tela (D-029). Só a
 * equipe Brasa (`usuarios:listar`); a exportação fica na auditoria, porque o
 * arquivo tem nomes e e-mails.
 */
export const GET = comTratamentoDeErros(async (request) => {
  const contexto = contextoDa(await exigirSessaoNaApi());
  const { busca, papel, situacao } = esquemaFiltrosDeUsuarios.parse(
    normalizarParametros(Object.fromEntries(request.nextUrl.searchParams)),
  );
  await registrarExportacaoDaAdministracao(db, contexto, "usuarios", {
    comBusca: Boolean(busca),
    papel: papel ?? null,
    situacao: situacao ?? null,
  });

  return respostaCsv({
    prefixoDoArquivo: "usuarios",
    cabecalho: ["Nome", "E-mail", "Perfil", "Empresas", "Situação", "Bloqueado em", "Criado em"],
    lotes: todasAsPaginas((paginacao) =>
      listarUsuariosDaPlataforma(db, contexto, { busca, papel, situacao }, paginacao),
    ),
    linha: (usuario) => [
      usuario.nome,
      usuario.email,
      ROTULO_DO_PAPEL[usuario.papelPlataforma ?? "cliente"],
      usuario.empresas,
      ROTULO_DA_SITUACAO_DO_USUARIO[usuario.bloqueadoEm ? "bloqueado" : "ativo"],
      usuario.bloqueadoEm ? formatarDataHora(usuario.bloqueadoEm) : "",
      formatarDataHora(usuario.createdAt),
    ],
  });
});
