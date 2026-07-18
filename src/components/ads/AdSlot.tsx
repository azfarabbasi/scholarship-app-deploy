"use client";

import { usePathname } from "next/navigation";
import { isAdsConfigured } from "@/lib/env";

/**
 * Paths where an ad must never render, regardless of where a developer
 * accidentally places `<AdSlot />` — a defense-in-depth check on top of
 * simply not placing the component there. Covers every route named in
 * `docs/checkpoint-6/analytics-and-ads-policy.md`: authentication, account
 * management (including deletion), staff admin, the privacy and security
 * pages, and the AI assistant (no ad may ever appear inside or beside an AI
 * answer).
 */
const AD_EXCLUDED_PATH_PREFIXES = ["/auth", "/account", "/staff", "/privacy", "/security", "/assistant"];

export interface AdSlotProps {
  /** A short, human description of the placement, e.g. "catalogue-inline", "footer" — shown only in a dev/test data attribute, never rendered as ad content. */
  placement: string;
  className?: string;
}

/**
 * Renders nothing at all unless ads are both enabled and fully configured
 * (`NEXT_PUBLIC_ADS_ENABLED=true` and a provider — see `isAdsConfigured()`).
 * When shown, this is a structural placeholder only: no live ad-network
 * call is made and no publisher slot ID is wired in, since this checkpoint
 * delivers ad *readiness* (configuration, placement rules, visual
 * separation, accessible labeling) rather than a functioning AdSense
 * integration, which requires a real, approved publisher account this
 * project does not have. Wiring an actual `<ins class="adsbygoogle">` unit
 * is a drop-in follow-up scoped entirely to this component. See
 * `docs/checkpoint-6/analytics-and-ads-policy.md`.
 */
export function AdSlot({ placement, className }: AdSlotProps) {
  const pathname = usePathname();
  const isExcludedPath = AD_EXCLUDED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!isAdsConfigured() || isExcludedPath) {
    return null;
  }

  return (
    <div
      role="complementary"
      aria-label="Advertisement"
      data-ad-placement={placement}
      className={`flex min-h-[90px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted text-xs text-foreground-subtle ${className ?? ""}`}
    >
      <span aria-hidden="true" className="mr-2 rounded bg-surface px-1.5 py-0.5 font-medium uppercase tracking-wide">
        Advertisement
      </span>
      <span>Ad space</span>
    </div>
  );
}
