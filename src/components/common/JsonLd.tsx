import { headers } from "next/headers";

/**
 * The HTML parser looks for the literal byte sequence "</script" regardless
 * of this tag's `type` attribute — a JSON string value containing that
 * sequence (e.g. an opportunity title or source label someone entered) would
 * otherwise close this element early and let whatever follows be parsed as
 * raw HTML/script. Replacing every literal "<" with its `<` escape
 * neutralises that without changing the JSON's meaning: `JSON.parse` decodes
 * `<` back to "<" either way.
 */
export function escapeJsonLd(json: string): string {
  return json.replace(/</g, "\\u003c");
}

/**
 * Renders a `<script type="application/ld+json">` block carrying the
 * current request's CSP nonce (see `src/lib/security/csp.ts`) — under this
 * app's nonce-based `script-src`, an inline script without a matching nonce
 * is silently blocked by the browser, structured data included.
 *
 * `suppressHydrationWarning` is required here, and is not a workaround for a
 * real bug: browsers strip the `nonce` *attribute* from every element right
 * after using it to validate CSP (a deliberate anti-XSS measure, so page
 * script can never read a live nonce back out of the DOM). The nonce this
 * Server Component renders is correct and present in the raw HTML the
 * browser parses — that's what CSP actually checks — but by the time
 * client-side React reconciles the tree, the DOM's `nonce` attribute is
 * already "" while the server-rendered value React remembers is not, which
 * is an unavoidable, cosmetic mismatch for this one attribute. This is the
 * same reason `next-themes` (see `ThemeProvider.tsx`) has to special-case
 * its own nonce prop; this component is server-only (never re-renders on
 * the client), so there is no "client nonce" to reconcile against — only
 * the browser's own post-parse stripping to account for.
 */
export async function JsonLd({ data }: { data: object }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: escapeJsonLd(JSON.stringify(data)) }}
    />
  );
}
