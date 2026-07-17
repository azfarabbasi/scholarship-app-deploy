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
  });
  // Public values are shaped, not secret; a parse failure here is a build
  // configuration bug, so surfacing the raw Zod error is safe and useful.
  cachedPublicEnv = result.success ? result.data : publicEnvSchema.parse({});
  return cachedPublicEnv;
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
