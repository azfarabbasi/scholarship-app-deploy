import { z } from "zod";

/**
 * Central environment validation. Two schemas because two trust boundaries:
 * `publicEnvSchema` covers only `NEXT_PUBLIC_*` values that are safe to ship
 * to a browser; `serverOnlyEnvSchema` covers everything that must never
 * reach client JavaScript. Never merge them into a single object that a
 * client component could import.
 */

const booleanFlag = z
  .string()
  .optional()
  .transform((value) => value === "true")
  .pipe(z.boolean());

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_FEEDBACK_EMAIL: z.string().email().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  /**
   * Gates the browser-notification permission UI (Checkpoint 4). Defaults
   * to off — with it unset, no notification-permission prompt or button is
   * ever rendered. See `src/components/notifications/NotificationPermissionSection.tsx`.
   */
  NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS: booleanFlag,
  /**
   * Checkpoint 6: privacy-friendly analytics abstraction (`src/lib/analytics`).
   * Off by default. A missing/invalid provider token never breaks the app —
   * the abstraction degrades to a no-op. See
   * `docs/checkpoint-6/analytics-and-ads-policy.md`.
   */
  NEXT_PUBLIC_ANALYTICS_ENABLED: booleanFlag,
  NEXT_PUBLIC_ANALYTICS_PROVIDER: z.enum(["none", "cloudflare"]).default("none"),
  NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: z.string().min(1).optional(),
  /**
   * Checkpoint 6: optional client-side error reporting. Never required —
   * unset means no error-reporting script loads at all. Never confuse with
   * the server-only `SENTRY_DSN` below; a DSN is a submission endpoint, not a
   * secret, but both still default to fully disabled.
   */
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  /**
   * Checkpoint 6: ad readiness. Off by default (`NEXT_PUBLIC_ADS_ENABLED=false`)
   * — no ad slot renders and no third-party ad script loads unless explicitly
   * enabled. See `docs/checkpoint-6/analytics-and-ads-policy.md`.
   */
  NEXT_PUBLIC_ADS_ENABLED: booleanFlag,
  NEXT_PUBLIC_AD_PROVIDER: z.enum(["none", "adsense"]).default("none"),
  NEXT_PUBLIC_ADSENSE_CLIENT_ID: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedPublicEnv: PublicEnv | null = null;

/** Safe to call from client components: only ever reads `NEXT_PUBLIC_*` values. */
export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv;
  }
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_FEEDBACK_EMAIL: process.env.NEXT_PUBLIC_FEEDBACK_EMAIL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS: process.env.NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS,
    NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
    NEXT_PUBLIC_ANALYTICS_PROVIDER: process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER,
    NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_ADS_ENABLED: process.env.NEXT_PUBLIC_ADS_ENABLED,
    NEXT_PUBLIC_AD_PROVIDER: process.env.NEXT_PUBLIC_AD_PROVIDER,
    NEXT_PUBLIC_ADSENSE_CLIENT_ID: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID,
  });
  // Public values are shaped, not secret; a parse failure here is a build
  // configuration bug, so surfacing the raw Zod error is safe and useful.
  cachedPublicEnv = result.success ? result.data : publicEnvSchema.parse({});
  return cachedPublicEnv;
}

/** Test-only: clears the module-level cache so a test can simulate a different env, mirroring `resetAiConfigCacheForTests()`. */
export function resetPublicEnvCacheForTests(): void {
  cachedPublicEnv = null;
}

/** Thrown instead of leaking which specific variable was missing/malformed to a response body. */
export class EnvironmentConfigurationError extends Error {
  constructor(context: string) {
    super(`ScholarTrack is not fully configured for "${context}". See docs/checkpoint-2/supabase-setup.md.`);
    this.name = "EnvironmentConfigurationError";
  }
}

const serverOnlyEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DATABASE_MIGRATION_URL: z.string().min(1).optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ENABLE_DATABASE_CATALOGUE: booleanFlag,
  ENABLE_STAFF_ADMIN: booleanFlag,
  /**
   * Local-testing convenience only: lets an Administrator review/approve
   * their own drafts solo, collapsing the review pipeline to one account.
   * Defaults to disabled — separation of duties applies to every role
   * unless a deployment explicitly opts in. Never enable outside a local/dev
   * environment. See `src/lib/auth/permissions.ts`.
   */
  ALLOW_ADMIN_SELF_REVIEW: booleanFlag,
  /**
   * Checkpoint 6: which of the four documented environment groups this
   * process is running as (local development, automated test, a
   * preview/staging deploy, or production). Drives `validateProductionEnvironment()`
   * below and the security-header/HSTS strategy in `next.config.ts`. Defaults
   * to "development" so an unset value never accidentally behaves like
   * production. See `docs/checkpoint-6/checkpoint-6-architecture.md`.
   */
  APP_ENV: z.enum(["development", "test", "preview", "production"]).default("development"),
  /**
   * Server-only. Optional generic error-reporter submission endpoint (e.g. a
   * Sentry DSN). Unset means server-side errors are only ever logged via
   * `src/lib/observability/logger.ts`, never sent anywhere.
   */
  SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  /** Shown on /security and /contact. Not a secret — just a contact address. */
  SECURITY_CONTACT_EMAIL: z.string().email().optional().or(z.literal("")),
  SUPPORT_EMAIL: z.string().email().optional().or(z.literal("")),
});

export type ServerEnv = z.infer<typeof serverOnlyEnvSchema> & PublicEnv;

/**
 * Validates and returns full server configuration. Throws
 * `EnvironmentConfigurationError` (a generic, safe-to-display message) rather
 * than ever surfacing which variable was the problem to a client — the
 * detailed Zod issues are only logged server-side via `console.error`.
 */
export function getServerEnv(context = "this feature"): ServerEnv {
  const result = serverOnlyEnvSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
    BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL,
    APP_BASE_URL: process.env.APP_BASE_URL,
    ENABLE_DATABASE_CATALOGUE: process.env.ENABLE_DATABASE_CATALOGUE,
    ENABLE_STAFF_ADMIN: process.env.ENABLE_STAFF_ADMIN,
    ALLOW_ADMIN_SELF_REVIEW: process.env.ALLOW_ADMIN_SELF_REVIEW,
    APP_ENV: process.env.APP_ENV,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SECURITY_CONTACT_EMAIL: process.env.SECURITY_CONTACT_EMAIL,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  });

  if (!result.success) {
    console.error(
      `ScholarTrack: server environment configuration is invalid for "${context}".`,
      result.error.flatten().fieldErrors,
    );
    throw new EnvironmentConfigurationError(context);
  }

  return { ...result.data, ...getPublicEnv() };
}

/** Non-throwing check used by public pages to decide whether to render a safe fallback. */
export function isDatabaseConfigured(): boolean {
  try {
    const env = getServerEnv("database catalogue");
    return env.ENABLE_DATABASE_CATALOGUE;
  } catch {
    return false;
  }
}

/** Non-throwing check used by navigation/staff routes to decide whether staff admin is enabled at all. */
export function isStaffAdminConfigured(): boolean {
  try {
    const env = getServerEnv("staff admin");
    return (
      env.ENABLE_STAFF_ADMIN &&
      Boolean(env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    );
  } catch {
    return false;
  }
}

/**
 * Non-throwing. Which of the four documented environment groups this process
 * believes it is running as. Never throws — an invalid/unset `APP_ENV`
 * safely resolves to "development" rather than breaking a page render.
 */
export function getAppEnv(): "development" | "test" | "preview" | "production" {
  const raw = process.env.APP_ENV;
  if (raw === "test" || raw === "preview" || raw === "production") {
    return raw;
  }
  return "development";
}

/** Non-throwing. `true` only for a process explicitly configured as production. */
export function isProductionEnvironment(): boolean {
  return getAppEnv() === "production";
}

/**
 * Non-throwing. Reads the three optional contact-email variables directly
 * (never through `getServerEnv()`, which throws when Supabase/database
 * configuration is missing) so `/contact` and `/security` render a safe
 * fallback ("no address configured yet") instead of a 500 on a deployment
 * that has no database at all.
 */
export function getContactEmails(): { security: string | null; support: string | null; feedback: string | null } {
  return {
    security: process.env.SECURITY_CONTACT_EMAIL?.trim() || null,
    support: process.env.SUPPORT_EMAIL?.trim() || null,
    feedback: process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() || null,
  };
}

/**
 * Non-throwing. The absolute base URL used to build canonical links, sitemap
 * entries, Open Graph URLs, and structured data — never throws, since a
 * missing value must never take SEO metadata generation down. Falls back to
 * `http://localhost:3000` exactly like `app/layout.tsx`'s own metadataBase
 * computation, which both should agree with.
 */
export function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  return configured && configured.startsWith("http") ? configured.replace(/\/+$/, "") : "http://localhost:3000";
}

/** Non-throwing check used to decide whether to render analytics script tags at all. */
export function isAnalyticsConfigured(): boolean {
  const env = getPublicEnv();
  if (!env.NEXT_PUBLIC_ANALYTICS_ENABLED) return false;
  if (env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "cloudflare") {
    return Boolean(env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN);
  }
  return false;
}

/** Non-throwing check used to decide whether to render any ad slot or ad script at all. */
export function isAdsConfigured(): boolean {
  const env = getPublicEnv();
  if (!env.NEXT_PUBLIC_ADS_ENABLED) return false;
  if (env.NEXT_PUBLIC_AD_PROVIDER === "adsense") {
    return Boolean(env.NEXT_PUBLIC_ADSENSE_CLIENT_ID);
  }
  return false;
}

/**
 * Thrown by `validateProductionEnvironment()` only — a boot-time failure,
 * deliberately loud (unlike `EnvironmentConfigurationError`, which exists to
 * degrade a single request gracefully). A process that reports itself as
 * production but is missing the configuration production traffic actually
 * needs should refuse to look healthy rather than silently serve a broken or
 * insecure deployment.
 */
export class ProductionConfigurationError extends Error {
  constructor(missing: string[]) {
    super(
      `ScholarTrack: APP_ENV=production but required configuration is missing or invalid: ${missing.join(", ")}. ` +
        "See docs/checkpoint-6/production-deployment-runbook.md.",
    );
    this.name = "ProductionConfigurationError";
  }
}

/**
 * Called once from `instrumentation.ts` at process boot. A no-op for every
 * environment except production — local development and preview/staging
 * deploys are never required to have Supabase/database configuration just to
 * start up (the app already degrades individual pages gracefully via
 * `isDatabaseConfigured()`/`isStaffAdminConfigured()`). Production is held to
 * a stricter bar: it must fail loudly at boot rather than silently serve a
 * half-configured instance to real users.
 */
export function validateProductionEnvironment(): void {
  if (getAppEnv() !== "production") {
    return;
  }

  const missing: string[] = [];
  if (!process.env.SUPABASE_SECRET_KEY) missing.push("SUPABASE_SECRET_KEY");
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl || !appBaseUrl.startsWith("https://")) missing.push("APP_BASE_URL (must be an https:// URL)");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || !appUrl.startsWith("https://")) missing.push("NEXT_PUBLIC_APP_URL (must be an https:// URL)");

  if (missing.length > 0) {
    const error = new ProductionConfigurationError(missing);
    console.error(error.message);
    throw error;
  }
}
