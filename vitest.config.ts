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
    },
  },
});
