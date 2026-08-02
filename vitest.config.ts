import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `import "server-only"` throws outside Next.js's "react-server" build
      // condition, which plain Vitest never sets — alias it to the package's
      // own no-op `empty.js` (see vitest.integration.config.ts) so pure
      // server-side logic (e.g. rate limiting, RAG helpers) can be unit
      // tested directly without a full Next.js runtime.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/lib/domain/**", "src/lib/schemas/opportunity-seed.ts"],
      /**
       * Phase 4 item 13 (launch-audit remediation): `npm run test:coverage`
       * previously had no threshold at all, and wasn't even run in CI — a
       * coverage collapse (a large deletion of tests, a big new untested
       * module) could land silently. Thresholds are set a few points BELOW
       * the actual current baseline (statements 28.8%, branches 25.3%,
       * functions 24.0%, lines 29.3% at the time this was added), not at an
       * aspirational target: this repo's server-heavy code (Server Actions,
       * DB repositories, middleware) is exercised mostly by the SEPARATE
       * integration (`db:test`) and e2e suites, which this unit-only
       * coverage run never sees, so the raw aggregate number is structurally
       * diluted and an ambitious blanket target would be actively
       * misleading. This is a regression floor, not a quality bar — it
       * ratchets up over time as real coverage grows, rather than blocking
       * today's baseline.
       */
      thresholds: {
        statements: 25,
        branches: 20,
        functions: 20,
        lines: 25,
      },
    },
  },
});
