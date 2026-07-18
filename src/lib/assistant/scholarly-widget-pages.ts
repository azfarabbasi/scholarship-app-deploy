/**
 * The floating Scholarly widget's page allowlist, shared by the server-side
 * gate (`app/layout.tsx` — skips the "is AI available" DB check entirely on
 * pages the widget can never appear on) and the client-side gate
 * (`ScholarlyWidget.tsx` — the actual mount/no-render decision). Kept in one
 * plain module so the two can never drift out of sync with each other.
 *
 * Deliberately an allowlist, not a denylist: staff/admin, auth, legal/static
 * content, account sub-pages (delete/sync/data/security), and the full
 * assistant pages themselves simply never match, with no risk of a new route
 * accidentally inheriting the widget.
 */
const ALLOWED_EXACT_PATHS = new Set(["/", "/workspace", "/calendar", "/notifications", "/account", "/eligibility", "/compare"]);
const ALLOWED_PREFIXES = ["/opportunities"];

export function isScholarlyWidgetPath(pathname: string): boolean {
  if (ALLOWED_EXACT_PATHS.has(pathname)) return true;
  return ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
