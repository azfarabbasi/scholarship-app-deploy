/**
 * Checkpoint 6: `npm run security:headers`.
 *
 * Static verification of the security-header strategy — deliberately static
 * (reading source, not booting a server) so it runs in CI without a database
 * or Supabase project, matching every other `validate-checkpointN.ts` script
 * in this repository. Checks real content, not just file existence: e.g. a
 * CSP that exists but allows `script-src *` would still fail this.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors: string[] = [];
let checksPassed = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    checksPassed += 1;
    return;
  }
  errors.push(message);
}

function read(relativePath: string): string {
  const absolutePath = path.join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

const nextConfig = read("next.config.ts");
const middleware = read("src/lib/supabase/middleware.ts");
const csp = read("src/lib/security/csp.ts");

// ---------------------------------------------------------------------------
// 1. Baseline static headers (next.config.ts)
// ---------------------------------------------------------------------------
check(nextConfig.includes("async headers()"), "next.config.ts must define a headers() function.");
check(nextConfig.includes("X-Content-Type-Options") && nextConfig.includes("nosniff"), "Missing X-Content-Type-Options: nosniff.");
check(nextConfig.includes("X-Frame-Options") && nextConfig.includes("DENY"), "Missing X-Frame-Options: DENY.");
check(nextConfig.includes("Referrer-Policy"), "Missing a Referrer-Policy header.");
check(nextConfig.includes("Permissions-Policy"), "Missing a Permissions-Policy header.");

// ---------------------------------------------------------------------------
// 2. Content-Security-Policy (nonce-based, per request)
// ---------------------------------------------------------------------------
check(existsSync(path.join(root, "src/lib/security/csp.ts")), "Missing src/lib/security/csp.ts.");
check(csp.includes("object-src 'none'"), "CSP must set object-src 'none'.");
check(csp.includes("base-uri 'self'"), "CSP must set base-uri 'self' (prevents <base> tag hijacking).");
check(csp.includes("form-action 'self'"), "CSP must set form-action 'self'.");
check(csp.includes("frame-ancestors 'none'"), "CSP must set frame-ancestors 'none' (clickjacking protection).");
check(!/script-src[^;]*\*/.test(csp.replace(/https:\/\/\*\./g, "")), "CSP script-src must never allow a bare wildcard host.");
check(csp.includes("'strict-dynamic'"), "CSP script-src should use 'strict-dynamic' with a per-request nonce, not a static allowlist.");
check(
  middleware.includes("Content-Security-Policy") && middleware.includes("buildContentSecurityPolicy"),
  "middleware.ts must set the Content-Security-Policy header on every response.",
);
check(
  middleware.includes("withSecurityHeaders") || middleware.includes("Content-Security-Policy"),
  "Every branch of updateSupabaseSession must apply security headers, not just the first return.",
);

// ---------------------------------------------------------------------------
// 3. Strict-Transport-Security (production only)
// ---------------------------------------------------------------------------
check(middleware.includes("Strict-Transport-Security"), "Missing Strict-Transport-Security (HSTS) header logic.");
check(middleware.includes("isProductionEnvironment()"), "HSTS must be gated on production, not sent to local http:// dev servers.");
const hstsMaxAgeMatch = middleware.match(/Strict-Transport-Security[^)]*max-age=(\d+)/);
check(Boolean(hstsMaxAgeMatch) && Number(hstsMaxAgeMatch?.[1]) >= 15552000, "HSTS max-age should be at least 180 days (15552000s).");

// ---------------------------------------------------------------------------
// 4. Private-route cache and indexing rules
// ---------------------------------------------------------------------------
check(middleware.includes("no-store"), "Missing no-store Cache-Control handling for private routes.");
check(middleware.includes("X-Robots-Tag") && middleware.includes("noindex"), "Missing X-Robots-Tag: noindex for private routes.");
check(middleware.includes('"/staff"') && middleware.includes('"/account"'), "Staff and account routes must be in the noindex prefix list.");

// ---------------------------------------------------------------------------
// 5. Safe redirects (no open redirect)
// ---------------------------------------------------------------------------
check(middleware.includes("sanitizeNextPath"), "Missing sanitizeNextPath() safe-redirect helper.");
check(
  middleware.includes('path.startsWith("//")') && middleware.includes('path.includes("://")'),
  "sanitizeNextPath must reject protocol-relative (//) and absolute (scheme://) redirect targets.",
);

console.log(`security:headers: ${checksPassed} check(s) passed.`);

if (errors.length > 0) {
  console.error(`\nsecurity:headers found ${errors.length} problem(s):\n`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("security:headers: all security header checks passed.");
