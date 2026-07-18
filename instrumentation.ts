/**
 * Next.js instrumentation hook — runs once per server process at boot, in
 * every environment (dev, `next start`, and whatever a hosting provider
 * calls to start the Node runtime). This is the one place production
 * configuration is verified eagerly rather than lazily on first request; see
 * `validateProductionEnvironment()` in `src/lib/env.ts` for exactly what it
 * checks and why it is a no-op everywhere except `APP_ENV=production`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateProductionEnvironment } = await import("@/lib/env");
    validateProductionEnvironment();
  }
}
