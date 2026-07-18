"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { initAnalytics, trackEvent } from "@/lib/analytics";

/**
 * Mounted once in the root layout. Both `initAnalytics()` and `trackEvent()`
 * are safe no-ops unless analytics is explicitly enabled and configured
 * (see `src/lib/analytics/index.ts`) — this component never loads a
 * third-party script or sends anything by itself. Only the pathname
 * (a route shape, e.g. "/opportunities/[slug]" territory) is recorded,
 * never full URLs with search params that could carry a search query.
 */
export function AnalyticsInit() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackEvent("page_viewed", { path: pathname });
  }, [pathname]);

  return null;
}
