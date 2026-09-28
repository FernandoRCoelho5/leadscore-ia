import type { NextConfig } from "next";

// Valida as variáveis de ambiente ao carregar a configuração (dev, build e start).
import "./src/env";

/**
 * Cabeçalhos de segurança aplicados a todas as respostas.
 * A Content Security Policy fica no src/proxy.ts porque precisa de um nonce
 * novo a cada requisição.
 */
const cabecalhosDeSeguranca = [
  // Obriga HTTPS por 2 anos, inclusive nos subdomínios.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Impede o navegador de "adivinhar" o tipo do arquivo (ex.: tratar upload como script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Não vaza o caminho completo das páginas para outros sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desliga recursos do navegador que o app não usa.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Proteção contra clickjacking para navegadores antigos (a CSP cobre os atuais).
  { key: "X-Frame-Options", value: "DENY" },
  // Isola a janela do app de páginas abertas por ele.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Não anuncia "X-Powered-By: Next.js" (menos informação para quem ataca).
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Padrão: 1 MB. A foto de perfil aceita até 2 MB (FOTO_TAMANHO_MAXIMO);
      // a folga cobre os bytes extras do multipart/form-data.
      bodySizeLimit: "2.5mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: cabecalhosDeSeguranca },
      // Respostas da API podem conter dados pessoais: nunca guardar em cache.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
