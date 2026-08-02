/**
 * Validates a same-origin redirect target coming from an untrusted `next`
 * query parameter (login forms, Supabase auth callbacks). Every check below
 * must pass before a path is trusted; failing any one of them returns
 * `fallback` instead.
 */

/** True if `value` contains any ASCII control character (0x00-0x1F or 0x7F). */
function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/** Matches a path prefix on a segment boundary (`/staff` or `/staff/...`). */
function isWithinPathPrefix(pathname: string, prefix: string): boolean {
  const normalizedPrefix = prefix.length > 1 && prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return pathname === normalizedPrefix || pathname.startsWith(`${normalizedPrefix}/`);
}

export interface SanitizeRedirectPathOptions {
  /** The path must start with this prefix (e.g. `/staff`). */
  requiredPrefix?: string;
  /** The path must NOT start with this prefix (e.g. `/staff`, for student flows). */
  disallowedPrefix?: string;
}

/**
 * `origin` must be the caller's own known-good origin (e.g. `request.nextUrl.origin`
 * on the server, `window.location.origin` in a client component) — never derived
 * from user input.
 *
 * Checks, in order:
 *  1. Exactly one leading slash. Rejects a missing leading slash and `//...`,
 *     which a browser resolves as protocol-relative (same scheme, different host).
 *  2. No backslash anywhere. Per the WHATWG URL spec, a backslash is treated
 *     the same as a forward slash when resolving a relative reference against
 *     a special-scheme (http/https) base — so `/\evil.com` normalizes to
 *     `//evil.com` once actually navigated, silently becoming protocol-relative
 *     even though the raw string never contained `//`.
 *  3. No control characters. Some URL parsers strip or special-case these,
 *     which could let a crafted string smuggle a scheme/host past a naive
 *     prefix check.
 *  4. Resolve with `new URL(path, origin)` and verify the resulting `.origin`
 *     still equals `origin` exactly — the authoritative check, since it asks
 *     the same parser a real navigation would use rather than pattern-matching
 *     the raw string ourselves. The path actually used is rebuilt from this
 *     parsed result, not the raw input.
 *  5. Apply optional `requiredPrefix`/`disallowedPrefix` scoping to the parsed,
 *     normalized pathname so dot segments cannot escape a flow boundary.
 */
export function sanitizeRedirectPath(
  path: string | null | undefined,
  origin: string,
  fallback: string,
  options: SanitizeRedirectPathOptions = {},
): string {
  if (!path) return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path.includes("\\") || hasControlCharacter(path)) return fallback;

  let resolved: URL;
  try {
    resolved = new URL(path, origin);
  } catch {
    return fallback;
  }
  if (resolved.origin !== origin) return fallback;
  // Scope the normalized pathname, not the raw input: `/staff/../account`
  // must not pass a staff-only prefix check and then resolve outside it.
  if (options.requiredPrefix && !isWithinPathPrefix(resolved.pathname, options.requiredPrefix)) return fallback;
  if (options.disallowedPrefix && isWithinPathPrefix(resolved.pathname, options.disallowedPrefix)) return fallback;

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
