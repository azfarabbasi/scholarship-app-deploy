/**
 * Builds the Content-Security-Policy header value applied to every
 * document response (see `src/lib/supabase/middleware.ts`). Follows the
 * nonce + `strict-dynamic` pattern documented by Next.js itself
 * (https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
 * so framework-injected inline scripts (hydration payloads, `next-themes`'s
 * blocking theme script) are allowed via a fresh per-request nonce rather
 * than a blanket `'unsafe-inline'` for scripts.
 *
 * `style-src` keeps `'unsafe-inline'` as a deliberate, documented exception:
 * Radix UI's positioning primitives (`@radix-ui/react-dialog`,
 * `@radix-ui/react-tooltip`) set inline `style` properties directly via the
 * CSSOM for floating-element placement, which nonces cannot unlock (the
 * nonce/hash CSP exception only applies to `<style>`/`<link>` elements, never
 * to the `style` attribute or `element.style.*` mutations) — the same
 * exception Next.js's own reference CSP example carries. Inline-style
 * injection is a much lower-severity primitive than inline script execution
 * (no arbitrary code execution), so this is an accepted, documented
 * trade-off rather than an oversight. See
 * `docs/checkpoint-6/security-hardening.md`.
 */

export interface CspOptions {
  nonce: string;
  supabaseUrl?: string;
  analyticsEnabled: boolean;
  adsEnabled: boolean;
  production: boolean;
  /**
   * Only ever pass `true` when `process.env.NODE_ENV === "development"` (see
   * `src/lib/supabase/middleware.ts`) — never derived from `production`
   * being false, since "not production" also covers `test`/`preview`
   * environments that run a real production build and must stay strict.
   * Next.js's own dev server (Turbopack/webpack Fast Refresh, and the dev
   * error overlay) evaluates code via `eval()`, which a strict CSP blocks
   * outright — Next's own CSP guide documents this exact exception:
   * https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy.
   * Defaults to `false`/omitted so every existing caller (and the production
   * build) stays exactly as strict as before. `production: true` always wins
   * over this flag regardless — see the implementation below — so this can
   * never relax a policy actually marked production.
   */
  development?: boolean;
}

export function buildContentSecurityPolicy({ nonce, supabaseUrl, analyticsEnabled, adsEnabled, production, development }: CspOptions): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  const connectSrc = ["'self'"];
  const imgSrc = ["'self'", "blob:", "data:"];
  const frameSrc = new Set<string>();

  // Dev-only, and only for script-src — style-src/connect-src/etc. are
  // unaffected. `production` unconditionally wins over `development` here —
  // "keep production strict" is an invariant of this function, not just a
  // convention callers have to get right, so a caller bug that somehow sets
  // both flags at once can never relax the production policy.
  if (development && !production) {
    scriptSrc.push("'unsafe-eval'");
  }

  if (supabaseUrl) {
    try {
      connectSrc.push(new URL(supabaseUrl).origin);
    } catch {
      // Malformed value — connect-src simply stays 'self'-only; getServerEnv()
      // already validates this shape elsewhere, so this is defense in depth.
    }
  }

  // Checkpoint 6: only widened when analytics is actually turned on
  // (NEXT_PUBLIC_ANALYTICS_ENABLED=true and a provider is fully configured —
  // see `isAnalyticsConfigured()` in src/lib/env.ts). Disabled by default, so
  // the default CSP never mentions a third-party analytics host at all.
  if (analyticsEnabled) {
    scriptSrc.push("https://static.cloudflareinsights.com");
    connectSrc.push("https://cloudflareinsights.com");
  }

  // Checkpoint 6: only widened when ads are actually turned on
  // (NEXT_PUBLIC_ADS_ENABLED=true and a provider is fully configured — see
  // `isAdsConfigured()`). Disabled by default, so the default CSP never
  // mentions an ad-network host at all.
  if (adsEnabled) {
    scriptSrc.push("https://pagead2.googlesyndication.com", "https://*.googlesyndication.com");
    connectSrc.push("https://*.googlesyndication.com", "https://*.doubleclick.net");
    imgSrc.push("https://*.googlesyndication.com", "https://*.gstatic.com");
    frameSrc.add("https://*.googlesyndication.com");
    frameSrc.add("https://*.doubleclick.net");
  }

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${imgSrc.join(" ")}`,
    `font-src 'self' data:`,
    `connect-src ${connectSrc.join(" ")}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `frame-src ${frameSrc.size > 0 ? [...frameSrc, "'self'"].join(" ") : "'none'"}`,
  ];

  if (production) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}
