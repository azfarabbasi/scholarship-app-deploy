import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Baseline security headers that must apply to every response,
        // including the handful of static/manifest paths middleware.ts
        // deliberately skips (`_next/static`, `_next/image`, `favicon.ico`,
        // `sw.js`, `manifest.webmanifest`, `icon`, `apple-icon` — see the
        // matcher in `middleware.ts`). The per-request Content-Security-Policy
        // (nonce-based) and Strict-Transport-Security (production-only)
        // headers live in `src/lib/supabase/middleware.ts` instead, since
        // both require a fresh value or a runtime check per request rather
        // than the static value this config can provide. See
        // `docs/checkpoint-6/security-hardening.md`.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
