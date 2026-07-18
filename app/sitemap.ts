import type { MetadataRoute } from "next";
import { getPublishedOpportunities } from "@/lib/catalogue/db-repository";
import { getAppBaseUrl, isDatabaseConfigured } from "@/lib/env";

/**
 * Every public, indexable route, plus one entry per published opportunity.
 * Deliberately excludes anything under the Checkpoint 6 noindex prefixes
 * (`/staff`, `/account`, `/auth`, `/api`, `/assistant/history`,
 * `/assistant/settings`, `/workspace`) — see `src/lib/supabase/middleware.ts`
 * for the matching `X-Robots-Tag` enforcement. Only `published` opportunities
 * are ever included: `getPublishedOpportunities()` is the exact same
 * database query the public catalogue itself uses, so a draft, in-review, or
 * archived record can never leak into the sitemap.
 */
export const dynamic = "force-dynamic";

// Kept in exact sync with `NOINDEX_PREFIXES` in src/lib/supabase/middleware.ts
// — `/workspace` and `/auth` are noindexed there (private/utility pages with
// no standalone SEO value), so they are deliberately absent here too.
const STATIC_PUBLIC_ROUTES = [
  "/",
  "/opportunities",
  "/eligibility",
  "/notifications",
  "/compare",
  "/calendar",
  "/settings",
  "/custom-opportunities/new",
  "/assistant",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/about",
  "/methodology",
  "/contact",
  "/faq",
  "/status",
  "/security",
  "/accessibility",
  "/advertising-policy",
  "/data-sources",
  "/verification-policy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppBaseUrl();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PUBLIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === "/" || route === "/opportunities" ? "daily" : "monthly",
    priority: route === "/" ? 1 : route === "/opportunities" ? 0.9 : 0.5,
  }));

  if (!isDatabaseConfigured()) {
    return staticEntries;
  }

  try {
    const opportunities = await getPublishedOpportunities();
    const opportunityEntries: MetadataRoute.Sitemap = opportunities.map((opportunity) => ({
      url: `${baseUrl}/opportunities/${opportunity.slug}`,
      lastModified: opportunity.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...staticEntries, ...opportunityEntries];
  } catch {
    // Database unreachable at build/request time — still return the static
    // route list rather than failing the whole sitemap request.
    return staticEntries;
  }
}
