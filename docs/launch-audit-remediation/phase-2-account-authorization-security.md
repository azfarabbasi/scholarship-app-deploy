# Launch audit remediation — Phase 2: account and authorization security

Fixes every Phase 2 item from the launch-blocker audit: the critical account-import
cross-account overwrite vulnerability, cloud-export validation hardening, replace-mode
completeness, IndexedDB data remanence on shared devices, RLS over-permissiveness on
sensitive staff-only tables, missing page-level role gates, an open-redirect gap in the
auth flows, and a JSON-LD script-tag-breakout/unsafe-URL gap. No user data was deleted or
destructively migrated; no opportunity content was fabricated, approved, or published.

## Every changed file and migration

**New migration:**
- `drizzle/0011_narrow_staff_rls_policies.sql` — drizzle-kit-generated `ALTER POLICY`
  statements narrowing seven tables' `authenticated` SELECT policy, plus a hand-authored
  `revoke select on "import_job_rows" from anon, authenticated;` appended in the same file
  (same mixed pattern as `0002_publication_invariants.sql`/`0010_...`).
- `drizzle/meta/0011_snapshot.json`, `drizzle/meta/_journal.json` — updated by
  `drizzle-kit generate`.

**Account data — critical fix (item 1):**
- `src/lib/db/actions/student/data-controls.ts` — full rewrite of `importMyAccountData`.
  Every imported row now gets a fresh server-generated `id` (`randomUUID()`); every
  `ON CONFLICT` target was re-scoped from the untrustworthy exported `id` to the table's own
  unique index that is itself composed with the caller's own `studentProfileId` — e.g.
  `(studentProfileId, slug)` for custom opportunities, `(studentProfileId, opportunityId)`
  for tracking, `(studentProfileId, targetType, targetId)` for notes,
  `(studentProfileId, stableKey)` for reminders — so a conflict can only ever land on a row
  the caller's own account already owns. Old-export-id → new-row-id maps
  (`customOpportunityIdMap`, `savedSearchIdMap`) resolve same-payload cross-references
  (a note/task pointing at one of the payload's own custom opportunities, a notification
  pointing at one of its own saved searches). Also: server-side byte-size check moved ahead
  of Zod parsing; `profile`/`planningPreferences`/`displayPreferences` are now actually
  re-imported (previously silently dropped); "replace" mode now also clears the four
  singleton rows (`userEligibilityAnswers`/`userReminderPreferences`/
  `userPlanningPreferences`/`userDisplayPreferences`) when the payload omits them;
  `syncMetadata` is deliberately still never re-imported (documented in-file as narrowing
  the exported contract, not an oversight — it's this device's own sync bookkeeping, not
  account content).

**Cloud-export validation hardening (item 2):**
- `src/lib/schemas/cloud-export.ts` — every array field capped (`MAX_ROWS = 5,000` for rows,
  `MAX_SMALL_ARRAY = 200` for nested arrays), every string field capped
  (`MAX_SHORT_TEXT = 300` / `MAX_TEXT = 20,000`), every URL field restricted to `http`/`https`
  via a new shared `isHttpUrl` check, loose `z.string()` id fields tightened to `z.uuid()`.
  `MIN_SUPPORTED_SCHEMA_VERSION = 1` added; `validateCloudExportPayload` now rejects both a
  newer-than-supported and an older-than-supported `schemaVersion` with a clear message.
- `src/lib/security/url.ts` (**new**) — shared `isHttpUrl(value)` helper (was previously
  duplicated inline in `cloud-export.ts`; also now used by the JSON-LD fix below).

**IndexedDB clearing wired up (item 4):**
- `src/components/account/SignOutButton.tsx` (**new**) — client component that calls
  `clearCloudWorkspaceLocalState(studentProfileId)` before the `/auth/logout` POST navigates
  away (a plain form POST gives client code no chance to run first).
- `src/components/account/AccountNav.tsx` — `studentProfileId` prop added; raw logout form
  replaced with `<SignOutButton>`.
- `app/account/layout.tsx` — passes `studentProfileId` through to `AccountNav`.
- `app/account/delete/page.tsx` — converted to fetch the session server-side and pass
  `studentProfileId` down.
- `src/components/account/DeleteAccountSection.tsx` — both `handleDeleteWorkspace` and
  `handleDeleteAccount` now call `clearCloudWorkspaceLocalState` after a successful deletion.
  (`clearCloudCache`/`clearOutboxForStudent`/`clearCloudWorkspaceLocalState` already existed,
  fully implemented, with doc comments claiming they ran "on sign-out" — they had zero call
  sites anywhere before this phase.)
- `src/components/account/CloudDataSection.tsx` — success message extended to report the
  newly-restored `profile`/`planningPreferences`/`displayPreferences` counts.

**RLS narrowing (item 5):**
- `src/lib/db/schema/common.ts` — `staffSelectPolicy(tableName, roles?)` gained an optional
  role-list parameter (`undefined` keeps today's "any active staff role" behavior for every
  untouched table); new `staffSelectOwnOrRolePolicy(tableName, ownerColumn, adminRoles)` for
  "own row or admin" tables; new internal `staffRolesArrayLiteral` helper that inlines role
  names as a literal SQL `ARRAY[...]::text[]` (needed because `sql\`${role}\`` interpolation
  renders as an unusable bind-parameter placeholder like `$1` inside a static migration file
  — caught by inspecting the generated SQL before applying it, see "Errors and fixes" below).
- `src/lib/db/schema/staff.ts` — `staff_profiles`/`staff_role_assignments`: narrowed from
  "any staff" to "own row OR administrator".
- `src/lib/db/schema/workflow.ts` — `review_assignments`: narrowed to "reviewer, assigner, or
  subject author on that row, OR administrator" (custom inline `pgPolicy`, three
  possible owner-like columns).
- `src/lib/db/schema/duplicates.ts` — `duplicate_candidates`: narrowed to
  `senior_reviewer`/`administrator` (matches `canManageDuplicates`).
- `src/lib/db/schema/imports.ts` — `import_jobs`: narrowed to `administrator`
  (matches `canRunImports`); `import_job_rows`: SELECT policy removed entirely and the base
  grant explicitly revoked (`revoke select ... from anon, authenticated`) — no legitimate
  direct-REST reader exists for row-level import detail, staff or otherwise.
- `src/lib/db/schema/audit.ts` — `audit_log`: narrowed to `administrator`
  (matches `canViewFullAuditLog`).
- `src/lib/db/schema/ai.ts` — `ai_safety_events`, `ai_provider_health`: narrowed to
  `administrator` (matches `canViewAiSafetyLog`/`canDisableAi`).

**Page-level role gates (item 6):**
- `app/staff/(protected)/duplicates/page.tsx` — added `canManageDuplicates` gate (was
  completely unguarded).
- `app/staff/(protected)/imports/page.tsx` — added `canRunImports` gate (was completely
  unguarded).
- `app/staff/(protected)/assignments/page.tsx` — added `canAssignReviewers` gate (was
  completely unguarded; this page also reads the full staff directory to populate the
  assignment dropdown).
- Audited every other staff page (`ai/*`, `organisations`, `taxonomies`, `discovery`,
  `documents`, `eligibility-rules`, `corrections`, `reviews`, `opportunities/*`, plus the
  already-correct `audit`/`team`/`ops`): all either already gate correctly inside their own
  data-fetching function (`ai/safety`, `ai/usage`, `ai/evaluations`, `discovery` all return
  empty/null for an unauthorized role) or only ever needed "any active staff role," which the
  shared layout already enforces, or serve public-readable catalogue data
  (`organisations`/`taxonomies` — mutations are separately gated in their Server Actions).

**Redirect sanitization (item 7):**
- `src/lib/security/redirect.ts` (**new**) — `sanitizeRedirectPath(path, origin, fallback, options)`:
  rejects a missing/doubled leading slash, rejects any backslash (the WHATWG URL spec treats
  `\` the same as `/` when resolving a relative reference against an http(s) base — so
  `/\evil.com` silently becomes `//evil.com`, a different origin, once actually navigated —
  the exact gap in the old regex-based check), rejects control characters, then resolves with
  `new URL(path, origin)` and verifies the resulting `.origin` still matches exactly.
- Replaced four independently-duplicated, weaker `sanitizeNextPath` implementations with
  calls to the shared function: `src/components/auth/StudentLoginForm.tsx`,
  `src/components/staff/StaffLoginForm.tsx`, `app/auth/callback/route.ts`,
  `app/staff/auth/callback/route.ts`. Also updated `src/lib/supabase/middleware.ts`'s own
  local sanitizer for consistency (lower risk there — its input is the server's own request
  pathname, not another user's attacker-controlled value).
- `scripts/validate-checkpoint2.ts` — updated a stale text-match check that literally
  grepped for the old function name `sanitizeNextPath`.

**JSON-LD escaping and URL protocol enforcement (item 8):**
- `src/components/common/JsonLd.tsx` — added `escapeJsonLd()`, replacing every literal `<`
  with `<` before the JSON is embedded via `dangerouslySetInnerHTML`. The HTML parser
  looks for the raw byte sequence `</script` regardless of this element's `type` attribute,
  so a string field (an opportunity title, a source label) containing `</script>` could
  previously close the element early.
- `app/opportunities/[slug]/page.tsx` — `buildOpportunityStructuredData` now only includes
  `officialUrl` in the JSON-LD `url` field when `isHttpUrl()` passes; a staff-entered
  `javascript:`/`data:` value is silently omitted rather than asserted into structured data.

**Tests (item 9):**
- `tests/integration/account-import-security.test.ts` (**new**) — the audit's explicitly
  required test: a malicious "attacker" import reusing a real "victim" row's exported `id`
  and `slug` cannot change the victim's row, and lands as the attacker's own new row instead;
  plus a control test proving legitimate same-user re-import still upserts correctly.
- `tests/integration/rls-policies.test.ts` — new `0011_narrow_staff_rls_policies.sql` describe
  block: own-row-vs-administrator for `staff_profiles`/`staff_role_assignments`,
  involved-vs-uninvolved-vs-administrator for `review_assignments`,
  role-tier checks for `duplicate_candidates`/`import_jobs`/`audit_log`, and a
  service-role-only proof for `import_job_rows`.
- `tests/integration/ai-rls.test.ts` — the pre-existing "staff can read ai_safety_events"
  test asserted the *old*, now-intentionally-changed behavior (any staff role); replaced with
  a reviewer-denied / administrator-allowed pair, plus the equivalent pair for
  `ai_provider_health`.
- `tests/unit/cloud-export-schema.test.ts` — new cases for schema-version bounds, a rejected
  `javascript:` `officialUrl`, an accepted `https:` one, an over-cap row count, and an
  oversized string field.
- `tests/unit/redirect-sanitization.test.ts` (**new**) — covers the accept path, every reject
  path (no leading slash, `//`, absolute URL, the backslash-normalization bypass
  specifically, control characters), and both `requiredPrefix`/`disallowedPrefix` modes.
- `tests/unit/json-ld-safety.test.ts` (**new**) — proves `escapeJsonLd` neutralizes a
  `</script>` breakout while round-tripping cleanly through `JSON.parse`, and covers
  `isHttpUrl`'s accept/reject cases.

## Security behavior before → after

| Area | Before | After |
|---|---|---|
| Account import | `ON CONFLICT (id) DO UPDATE` trusted the *exported* row's own `id` as both the inserted value and the conflict target — Postgres's conflict match doesn't check row ownership, so a crafted import containing another student's real row id would silently overwrite that student's data under the attacker's own session | Every row gets a fresh server-generated `id`; every conflict target is the table's own unique index composed with the caller's *own* `studentProfileId` — a conflict can structurally only ever land on a row the caller already owns |
| Cloud-export validation | Unbounded arrays/strings, no URL-protocol check, no schema-version floor/ceiling | Every array/string capped, `http`/`https`-only URLs, schema version rejected both above and below the supported range |
| Replace mode | `profile`/`planningPreferences`/`displayPreferences` silently dropped on import despite being exported; four singleton rows never cleared when a "replace" payload omitted them | All three re-imported; all four singletons explicitly cleared in replace mode when absent from the payload |
| IndexedDB on shared devices | `clearCloudCache`/`clearOutboxForStudent`/`clearCloudWorkspaceLocalState` existed, fully implemented, but had zero call sites — a previous student's cached notes/tracking remained DevTools-inspectable indefinitely after sign-out | Wired into sign-out, workspace deletion, and account deletion |
| `staff_profiles` / `staff_role_assignments` RLS | Any active staff role could read the *entire* directory via direct Supabase REST | Own row only, unless administrator |
| `review_assignments` RLS | Any active staff role could read *every* assignment via direct REST | Only the reviewer/assigner/subject-author on that specific row, or an administrator |
| `duplicate_candidates` / `import_jobs` / `audit_log` / `ai_safety_events` / `ai_provider_health` RLS | Any active staff role | Administrator only (or senior_reviewer+ for duplicates), matching each table's actual app-layer permission function |
| `import_job_rows` RLS | Any active staff role could read via direct REST | No `authenticated`/`anon` grant at all — `service_role` only |
| `/staff/duplicates`, `/staff/imports`, `/staff/assignments` pages | No role check beyond "signed in as any staff member" | Redirect to `/staff` unless `canManageDuplicates`/`canRunImports`/`canAssignReviewers` |
| Auth redirect (`?next=`) | Regex-based check missed the WHATWG backslash-to-slash normalization — `/\evil.com` passed the old checks but resolves to a different origin once actually navigated | `new URL(path, origin)` + exact origin comparison after rejecting backslashes/control characters/malformed leading slashes |
| JSON-LD structured data | Bare `JSON.stringify(data)` in `dangerouslySetInnerHTML` — a string field containing `</script>` could break out of the script element; a non-http(s) `officialUrl` was asserted as-is | `<` escaped to `<`; `officialUrl` omitted unless it passes `isHttpUrl` |

## Commands run and exact results

| Command | Result |
|---|---|
| `npx drizzle-kit generate` | Generated `0011_narrow_staff_rls_policies.sql` + snapshot (offline diff, no live DB touched) |
| `npm run db:reset:test` (local Docker `db-test`) | Migrations applied successfully |
| `npm run db:test` | **105/105 passed** (was 86 before this phase; +19 net new) |
| `npm run typecheck` | PASSED, no errors |
| `npm run lint` | PASSED, no errors |
| `npm run test` (unit) | **476 passed, 1 skipped** (was 453 passed/1 skipped; +23 net new) |
| `npm run checkpoint2:validate` | **504/504 passed** (was 501; +1 net new check, 1 stale check text updated in place) |
| `npm run build` | PASSED — all 68 routes compile |

## Notes on migration safety

- Every policy change is an `ALTER POLICY` on an existing policy name (deliberately reused
  the same `*_select_staff` name rather than renaming, so drizzle-kit's diff produces a plain
  in-place alter instead of a drop+create it would otherwise want to interactively
  disambiguate as a rename — a prompt that needs a real TTY, unavailable in this
  environment). No table, column, or row was touched.
- `import_job_rows`'s `revoke select ... from anon, authenticated` is the only DDL beyond
  policy alterations — it revokes a *grant*, not data; nothing is deleted.
- Applied cleanly against a **fresh** local test database in this session. Generated and
  reviewed but **not applied to the real Supabase database** — that requires the same
  explicit `npm run db:migrate` deploy step called out in the Phase 1 report.

## Remaining manual content/deployment tasks

- Run `npm run db:migrate` against the real target database when ready to deploy this phase.
- No further action needed for the account-import/cloud-export/IndexedDB fixes — they take
  effect immediately on deploy, with no data backfill required.

## Honest gaps / deferred within Phase 2

- **`official_sources.url` (and similar staff-entered external URLs) still has no
  protocol validation at the point staff *capture* it** (`addOfficialSource` in
  `opportunity-relations.ts` takes `input.url` with no Zod schema at all). This phase closed
  the JSON-LD *rendering* side (item 8's literal scope) by filtering at the point structured
  data is built, but did not add capture-time validation — a staff member could still save a
  `javascript:`/`data:` official-source URL, which would be silently omitted from JSON-LD but
  could still render as a raw, unvalidated `<a href>` link elsewhere in the UI if any such
  link exists outside this phase's review. Worth a follow-up `httpUrlSchema`-style check on
  that Server Action input, matching the pattern already used in `cloud-export.ts`.
- **`organisations`/`taxonomies` staff pages remain read-accessible to every staff role**,
  including rows/statuses a public visitor wouldn't see (their `publicSelectPolicy` filters
  by status; the staff page shows all statuses). Judged low-risk and left as-is: the data
  itself is fundamentally public-facing catalogue content, not private/sensitive, and the
  actual mutating Server Actions (`reference-data.ts`) already enforce
  `canManageOrganisations`/`canManageTaxonomies` correctly. Flagged here for the record rather
  than silently decided.
- **Phase 1's already-documented gaps remain open** (published-catalogue-reads-from-snapshot,
  no return-to-draft workflow from `published`, deadline cycles/occurrences lack dual-control
  tracking) — unchanged by this phase, not re-litigated here.
