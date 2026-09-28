import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (no Next.js 16, substitui o antigo middleware.ts): roda antes de cada
 * página. Faz duas coisas:
 *
 * 1. Manda para o login quem abre uma área logada sem cookie de sessão. É só
 *    uma checagem rápida (o cookie não é validado aqui): a proteção de verdade
 *    está no servidor, em cada página e ação (src/server/auth/sessao.ts).
 * 2. Aplica a Content Security Policy (CSP) com um nonce novo a cada requisição.
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
  /** Página que outros sites podem exibir em iframe (só o formulário público, D-028). */
  incorporavel?: boolean;
};

/**
 * Quem pode exibir a página em iframe. O formulário público vai no site do
 * cliente, que pode estar em qualquer domínio com HTTPS; o resto do app nunca
 * aparece em iframe (proteção contra clickjacking).
 */
export function quemPodeIncorporar({ desenvolvimento, incorporavel }: OpcoesDeCsp): string {
  if (!incorporavel) {
    return "'none'";
  }
  return desenvolvimento ? "'self' https: http://localhost:*" : "'self' https:";
}

export function montarCsp(nonce: string, opcoes: OpcoesDeCsp): string {
  const { desenvolvimento, https } = opcoes;
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
    `frame-ancestors ${quemPodeIncorporar(opcoes)}`,
    ...(https ? ["upgrade-insecure-requests"] : []),
  ];
  return diretivas.join("; ");
}

/** Prefixos das áreas que exigem login (também ficam fora dos buscadores, em app/robots.ts). */
export const AREAS_LOGADAS = [
  "/painel",
  "/leads",
  "/membros",
  "/configuracoes",
  "/perfil",
  "/admin",
  "/onboarding",
  "/empresa-bloqueada",
];

export function exigeLogin(caminho: string): boolean {
  return AREAS_LOGADAS.some((area) => caminho === area || caminho.startsWith(`${area}/`));
}

/** Formulário público de captação (/f/[slug]): a única página incorporável. */
export function ehFormularioPublico(caminho: string): boolean {
  return caminho.startsWith("/f/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (exigeLogin(pathname) && !getSessionCookie(request)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("proximo", pathname);
    return NextResponse.redirect(login);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = montarCsp(nonce, {
    desenvolvimento: process.env.NODE_ENV === "development",
    https:
      request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    incorporavel: ehFormularioPublico(pathname),
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
