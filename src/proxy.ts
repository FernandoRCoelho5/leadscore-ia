import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (no Next.js 16, substitui o antigo middleware.ts): roda antes de cada
 * página. Hoje ele aplica a Content Security Policy (CSP) com um nonce novo a
 * cada requisição; na Etapa 4 passa também a exigir sessão nas rotas do painel.
 *
 * O nonce é um valor aleatório que o Next.js coloca nos próprios <script>.
 * O navegador só executa scripts com esse valor, então um script injetado por
 * um atacante (XSS) é bloqueado.
 */

type OpcoesDeCsp = {
  /** Em desenvolvimento o React precisa de eval e o Next injeta estilos inline. */
  desenvolvimento: boolean;
  /** `upgrade-insecure-requests` só faz sentido em HTTPS (quebraria o localhost). */
  https: boolean;
};

export function montarCsp(nonce: string, { desenvolvimento, https }: OpcoesDeCsp): string {
  const diretivas = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
    ...(desenvolvimento
      ? ["style-src 'self' 'unsafe-inline'"]
      : [
          `style-src 'self' 'nonce-${nonce}'`,
          // Tags <style> e <link> só com o nonce.
          `style-src-elem 'self' 'nonce-${nonce}'`,
          // Atributos style="..." (usados pelo next/image e por bibliotecas de gráfico)
          // não executam código; vazar dados por CSS exigiria carregar recursos
          // externos, o que img-src, font-src e connect-src 'self' já bloqueiam.
          "style-src-attr 'unsafe-inline'",
        ]),
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Nenhum site pode exibir o app em iframe (a Etapa 6 libera só /f/[slug]).
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ];
  return diretivas.join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = montarCsp(nonce, {
    desenvolvimento: process.env.NODE_ENV === "development",
    https:
      request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
  });

  // O Next.js lê a CSP da requisição para descobrir o nonce e aplicá-lo nos scripts.
  const cabecalhosDaRequisicao = new Headers(request.headers);
  cabecalhosDaRequisicao.set("x-nonce", nonce);
  cabecalhosDaRequisicao.set("Content-Security-Policy", csp);

  const resposta = NextResponse.next({ request: { headers: cabecalhosDaRequisicao } });
  resposta.headers.set("Content-Security-Policy", csp);
  return resposta;
}

export const config = {
  matcher: [
    {
      // Todas as páginas, exceto API, arquivos estáticos e pré-carregamentos de links.
      // As barras finais evitam excluir por engano páginas como /apiario.
      source: "/((?!api/|_next/static/|_next/image|favicon\\.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
