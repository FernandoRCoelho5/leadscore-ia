import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { COOKIE_DO_TEMA, lerTema } from "@/lib/tema";

import "./globals.css";

// Fonte da identidade Brasa. O next/font baixa a fonte no build e a serve do
// próprio domínio: sem requisição ao Google no navegador (bom para a CSP e a LGPD).
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Brasa",
  title: { default: "Brasa", template: "%s · Brasa" },
  description:
    "Seus leads mais quentes, primeiro. A Brasa qualifica leads com inteligência artificial.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A CSP usa um nonce novo a cada requisição (src/proxy.ts), então toda página
  // precisa ser renderizada no servidor a cada acesso: HTML gerado no build não
  // teria o nonce e seus scripts seriam bloqueados pelo navegador.
  await connection();

  // O tema vem do cookie e é aplicado já no HTML do servidor (sem "piscar").
  const tema = lerTema((await cookies()).get(COOKIE_DO_TEMA)?.value);

  return (
    <html lang="pt-BR" data-tema={tema} className={`${sora.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
