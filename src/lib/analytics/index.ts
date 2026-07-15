/**
 * No-op analytics abstraction. Checkpoint 1 collects nothing: every call
 * here is a deliberate dead end so that a later, privacy-reviewed analytics
 * provider can be wired in behind this single module instead of scattering
 * tracking calls through components.
 *
 * Must never receive notes, checklist text, application details, personal
 * deadlines, custom opportunity contents, or planning preferences.
 */
export type AnalyticsEventName =
  | "catalogue_viewed"
  | "opportunity_viewed"
  | "filter_applied"
  | "shortlist_toggled"
  | "custom_opportunity_created"
  | "backup_exported"
  | "backup_imported"
  | "pwa_installed";

export interface AnalyticsEventProperties {
  [key: string]: string | number | boolean | null;
}

const ANALYTICS_ENABLED = false;

export function trackEvent(name: AnalyticsEventName, properties?: AnalyticsEventProperties): void {
  if (!ANALYTICS_ENABLED) {
    return;
  }
  // Intentionally unreachable in Checkpoint 1. A future privacy-reviewed
  // provider integration replaces this body without touching call sites.
  void name;
  void properties;
}
