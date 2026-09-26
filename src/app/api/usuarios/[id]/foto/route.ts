import { db } from "@/db";
import { ErroNaoAutenticado } from "@/lib/erros";
import { armazenamentoNoBlob } from "@/server/armazenamento/fotos";
import { contextoDa, obterSessao } from "@/server/auth/sessao";
import { comTratamentoDeErros } from "@/server/http/responder";
import { obterFotoDoUsuario } from "@/server/services/foto";

/**
 * Entrega a foto de perfil guardada no Blob privado (D-024). A sessão e a
 * permissão são conferidas aqui, ao lado da leitura do arquivo (e não só no
 * proxy), como recomenda a documentação da Vercel para stores privados.
 */
export const GET = comTratamentoDeErros<RouteContext<"/api/usuarios/[id]/foto">>(
  async (_request, { params }) => {
    const sessao = await obterSessao();
    if (!sessao) {
      throw new ErroNaoAutenticado();
    }
    const { id } = await params;
    const foto = await obterFotoDoUsuario(db, armazenamentoNoBlob, contextoDa(sessao), id);

    return new Response(foto.conteudo, {
      headers: {
        // Tipo definido pelo app (validado no envio), nunca o informado por quem enviou.
        "Content-Type": foto.tipo,
        "Content-Length": String(foto.tamanho),
        // Dado pessoal: sem cache nenhum (a mesma regra de toda a /api no next.config).
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        // Se o arquivo for aberto direto, nada nele pode executar.
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  },
);
