# Checkpoint 7: Final security readiness

Verified via `npm run launch:security` (aggregates `security:secrets` + `security:headers` plus
launch-specific checks) — real run this session: **11/11 checks passed**. Full architectural
detail: `docs/checkpoint-6/security-hardening.md`.

## Checklist

| Item | Status | Evidence |
|---|---|---|
| No secrets committed | ✅ | `npm run security:secrets` — scans every git-tracked-or-not-ignored file for Supabase/Groq/JWT/PEM/connection-string shapes. Passed. |
| `.env`/`.env.local` ignored | ✅ | `.gitignore` excludes `.env`, `.env.local`, `.env*.local`; `security:secrets` double-checks via `git ls-files` directly. |
| Secret scanner passes | ✅ | See above. |
| RLS tests pass | ✅ | `npm run db:test` — 75/75, including 20 AI RLS tests and cross-user isolation tests (real Docker Postgres run, see completion report). |
| Private routes protected | ✅ | `middleware.ts` redirects unauthenticated `/staff/**`/`/account/**`; every Server Action/Route Handler independently re-verifies server-side. |
| Staff routes protected | ✅ | Same mechanism; `canViewOpsDiagnostics()`, `canManageStaff()`, etc. gate individual actions. |
| Account routes protected | ✅ | Same mechanism. |
| No open redirects | ✅ | `sanitizeNextPath()` rejects protocol-relative (`//`) and absolute (`scheme://`) redirect targets — checked by `security:headers`. |
| Private routes no-store | ✅ | `middleware.ts`'s `ALWAYS_NO_STORE_PREFIXES`/session-aware `Cache-Control` logic. |
| Private routes noindex | ✅ | `middleware.ts`'s `NOINDEX_PREFIXES` sets `X-Robots-Tag: noindex`. |
| Service worker excludes private/API/staff/account/AI routes | ✅ | `public/sw.js`'s fetch handler returns early (never intercepts) for `/staff`, `/api/staff`, `/account`, `/api/account`, `/auth`. |
| CSP/security headers exist | ✅ | Nonce-based CSP (`src/lib/security/csp.ts`), HSTS (production only), `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`/`Permissions-Policy`. |
| Rate limits for abuse-prone actions | ✅ | AI (guest cookie + signed-in DB counter), correction reports (cookie-based, new in Checkpoint 6). |
| Import limits exist | ✅ | CSV import: 2 MB file size cap, 500-row cap (`src/lib/csv/parse.ts`). |
| Correction-report spam friction | ✅ | Honeypot field + rate limiting. |
| AI rate limiting exists | ✅ | See above. |
| No sensitive document upload | ✅ | Every `type="file"` input in the app accepts only `application/json` or `.csv` — verified programmatically (`launch:security`, mirrors `checkpoint6:validate`). |

## What's new this checkpoint

Nothing structural — Checkpoint 6 built the security posture; Checkpoint 7 re-verifies it end to
end via a single `launch:security` command, and adds one real fix found during UX review: the
duplicate-merge staff action (`DuplicateCandidateActions.tsx`) previously fired immediately with
no confirmation step beyond typing a reason — now behind a confirmation dialog, matching the
same pattern as account deletion and local-data clearing. Audit logging for this action already
existed (`recordAuditEvent` in `mergeDuplicates()`) and was unaffected.

## Known gaps (unchanged from Checkpoint 6, not blocking)

- No real Sentry/error-reporting SDK wired in (structural hook only).
- Ad readiness is structural only (no approved AdSense account).
- See `docs/checkpoint-6/checkpoint-6-completion-report.md` for the full list.
