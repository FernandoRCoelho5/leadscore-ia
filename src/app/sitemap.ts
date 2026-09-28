import type { MetadataRoute } from "next";

import { env } from "@/env";
import { CAMINHO_DA_POLITICA } from "@/lib/privacidade";

/** Páginas públicas para os buscadores (o robots.txt só aponta para cá em produção). */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/cadastro", "/login", CAMINHO_DA_POLITICA].map((caminho) => ({
    url: new URL(caminho, env.URL_DO_APP).toString(),
  }));
}
