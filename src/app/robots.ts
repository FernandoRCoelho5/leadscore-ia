import type { MetadataRoute } from "next";

import { env } from "@/env";
import { AREAS_LOGADAS } from "@/proxy";

/**
 * Instruções aos buscadores. Só a produção é indexável, e nela só as páginas
 * públicas: áreas logadas, API, convites e os formulários das empresas
 * clientes (que também têm noindex) ficam de fora. Gerado no build.
 */
export default function robots(): MetadataRoute.Robots {
  if (env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/f/", "/convite/", ...AREAS_LOGADAS],
    },
    sitemap: `${env.URL_DO_APP}/sitemap.xml`,
  };
}
