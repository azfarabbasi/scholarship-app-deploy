import { headers } from "next/headers";

/**
 * Renders a `<script type="application/ld+json">` block carrying the
 * current request's CSP nonce (see `src/lib/security/csp.ts`) — under this
 * app's nonce-based `script-src`, an inline script without a matching nonce
 * is silently blocked by the browser, structured data included.
 */
export async function JsonLd({ data }: { data: object }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
