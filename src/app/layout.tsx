import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Nome provisório até a definição da identidade visual (Etapa 4).
export const metadata: Metadata = {
  title: { default: "LeadScore IA", template: "%s · LeadScore IA" },
  description: "Qualificação de leads com inteligência artificial.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A CSP usa um nonce novo a cada requisição (src/proxy.ts), então toda página
  // precisa ser renderizada no servidor a cada acesso: HTML gerado no build não
  // teria o nonce e seus scripts seriam bloqueados pelo navegador.
  await connection();

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
