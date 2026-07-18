import "server-only";

/**
 * Server-side error logging abstraction. Every call goes through here
 * instead of a bare `console.error` scattered across route handlers/actions,
 * so a future real error reporter (Sentry or otherwise) is one place to
 * wire in rather than a search-and-replace across the codebase. `SENTRY_DSN`
 * is read directly (never through the throwing `getServerEnv()`, since a
 * logging call must never itself throw) — unset means every error is only
 * ever logged to the process's own stdout/stderr, which is enough for a
 * `docker compose logs` / hosting-provider log tail in this project's
 * free-first deployment target. See
 * `docs/checkpoint-6/checkpoint-6-architecture.md`.
 */

export interface ErrorReportContext {
  /** A short, stable machine-readable label (e.g. "assistant.ask", "correction-report.submit"). */
  scope: string;
  [key: string]: unknown;
}

/**
 * A short, non-sensitive reference students/staff can quote in a support
 * request without exposing a stack trace or internal identifiers.
 */
export function generateErrorReferenceId(): string {
  return `ST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Logs an error server-side and returns a reference id safe to show a user.
 * Never throws itself — a failure to report an error must never mask the
 * original error or crash the caller.
 */
export function reportError(error: unknown, context: ErrorReportContext): string {
  const referenceId = generateErrorReferenceId();
  try {
    console.error(`ScholarTrack [${context.scope}] (ref ${referenceId}):`, error, context);
    const dsn = process.env.SENTRY_DSN?.trim();
    if (dsn) {
      // Structural hook only: no Sentry SDK dependency is added in this
      // checkpoint (see docs/checkpoint-6/checkpoint-6-architecture.md for
      // why), so a configured DSN currently just enables this log line
      // noting that a real reporter would have received the event. Wiring
      // an actual SDK call here is a drop-in change scoped to this module.
      console.error(`ScholarTrack: SENTRY_DSN is configured but no reporter SDK is wired in yet (ref ${referenceId}).`);
    }
  } catch {
    // Never let logging itself throw.
  }
  return referenceId;
}
