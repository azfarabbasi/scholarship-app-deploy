/**
 * Privacy-friendly analytics abstraction. Disabled by default
 * (`NEXT_PUBLIC_ANALYTICS_ENABLED=false`) — every call here is a safe no-op
 * until a deployment explicitly enables it AND fully configures a provider
 * (see `isAnalyticsConfigured()` in `src/lib/env.ts`). No event payload may
 * ever contain notes, checklist text, application details, personal
 * deadlines, custom opportunity contents, eligibility answers, AI chat text,
 * account export/import contents, or a raw free-text search query — every
 * event name below is deliberately a category/count, never free text a
 * student typed. See `docs/checkpoint-6/analytics-and-ads-policy.md`.
 *
 * Honest about what the one supported provider actually does: Cloudflare
 * Web Analytics (the free-tier option this abstraction targets, per
 * ADR-008's budget constraint) is a passive page-view/Core-Web-Vitals
 * beacon — it has no custom-event API. `trackEvent()` therefore remains a
 * safe, fully-testable no-op for every provider today; it exists so call
 * sites across the app already use the right shape, ready for a future
 * provider that does support custom events (e.g. a self-hosted Plausible/
 * Umami instance) without touching a single call site.
 */
import { getPublicEnv, isAnalyticsConfigured } from "@/lib/env";

export type AnalyticsEventName =
  | "page_viewed"
  | "opportunity_viewed"
  | "opportunity_detail_opened"
  | "filter_applied"
  | "filter_category_used"
  | "search_performed"
  | "saved_search_created"
  | "reminder_created"
  | "shortlist_toggled"
  | "custom_opportunity_created"
  | "backup_exported"
  | "backup_imported"
  | "pwa_install_prompt_shown"
  | "pwa_installed"
  | "correction_report_opened"
  | "correction_report_submitted"
  | "ai_answer_feedback_category"
  | "account_signup_result"
  | "account_login_result";

export interface AnalyticsEventProperties {
  [key: string]: string | number | boolean | null;
}

let cloudflareBeaconInjected = false;

/** Passive page-view beacon only — see the module doc above for why this is the entire integration surface. */
function ensureCloudflareBeacon(token: string): void {
  if (cloudflareBeaconInjected || typeof document === "undefined") return;
  cloudflareBeaconInjected = true;
  const script = document.createElement("script");
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.defer = true;
  script.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.head.appendChild(script);
}

/**
 * Call once, client-side, near the app root (see `AnalyticsInit` in
 * `src/components/layout/AnalyticsInit.tsx`). A no-op unless analytics is
 * both enabled and fully configured — never loads a third-party script
 * otherwise.
 */
export function initAnalytics(): void {
  if (!isAnalyticsConfigured()) return;
  const env = getPublicEnv();
  if (env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "cloudflare" && env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN) {
    ensureCloudflareBeacon(env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN);
  }
}

/**
 * Records a privacy-safe, category-level product event. Safe to call from
 * anywhere (guest or signed-in, analytics enabled or not) — always a no-op
 * today (see the module doc above), and never throws.
 */
export function trackEvent(name: AnalyticsEventName, properties?: AnalyticsEventProperties): void {
  if (!isAnalyticsConfigured()) {
    return;
  }
  // No currently-supported provider accepts custom events (see module doc).
  // This branch intentionally does nothing yet; a future custom-event
  // provider implementation replaces this body without touching call sites.
  void name;
  void properties;
}
