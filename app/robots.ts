import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/env";

/**
 * Kept in exact sync with `NOINDEX_PREFIXES` in
 * `src/lib/supabase/middleware.ts` — that middleware is the enforcement
 * mechanism (an `X-Robots-Tag: noindex` header on every matching response,
 * which applies even to a crawler that ignores robots.txt); this file is the
 * courtesy signal well-behaved crawlers check before requesting anything.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/staff", "/account", "/auth", "/api", "/assistant/history", "/assistant/settings", "/workspace"],
    },
    sitemap: `${getAppBaseUrl()}/sitemap.xml`,
  };
}
