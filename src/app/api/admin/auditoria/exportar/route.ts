import { db } from "@/db";
import { resumirDetalhes, rotuloDaAcao } from "@/lib/auditoria";
import { formatarDataHora } from "@/lib/datas";
import {
  esquemaFiltrosDaAuditoria,
  filtrosDaAuditoriaDoRepositorio,
  normalizarParametros,
} from "@/lib/validacao/filtros";
import { contextoDa, exigirSessaoNaApi } from "@/server/auth/sessao";
import { respostaCsv } from "@/server/http/csv";
import { comTratamentoDeErros } from "@/server/http/responder";
import { exportarAuditoria } from "@/server/services/administracao";

/**
 * Exporta em CSV os eventos da auditoria com os filtros da tela (D-029). Só a
 * equipe Brasa (`auditoria:ver`), lendo em lotes por cursor.
 */
export const GET = comTratamentoDeErros(async (request) => {
  const sessao = await exigirSessaoNaApi();
  const filtros = esquemaFiltrosDaAuditoria.parse(
    normalizarParametros(Object.fromEntries(request.nextUrl.searchParams)),
  );
  const lotes = await exportarAuditoria(
    db,
    contextoDa(sessao),
    filtrosDaAuditoriaDoRepositorio(filtros),
  );

  return respostaCsv({
    prefixoDoArquivo: "auditoria",
    cabecalho: [
      "Quando",
      "Ação",
      "Código da ação",
      "Quem",
      "E-mail de quem",
      "Empresa",
      "Tipo do recurso",
      "ID do recurso",
      "Detalhes",
    ],
    lotes,
    linha: (evento) => [
      formatarDataHora(evento.createdAt),
      rotuloDaAcao(evento.acao),
      evento.acao,
      evento.atorNome ?? "Sistema",
      evento.atorEmail,
      evento.empresaNome,
      evento.recursoTipo,
      evento.recursoId,
      resumirDetalhes(evento.detalhes),
    ],
  });
});
