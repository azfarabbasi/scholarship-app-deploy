# Checkpoint 2 traceability

Maps each requirement section from the Checkpoint 2 brief to its implementation, migration,
test, and validation method. Status legend: ✅ done and verified · ⚠️ done with a documented
limitation · ⛔ deferred (with reason).

| # | Requirement | Implementation | Migration | Test | Validation | Status |
|---|---|---|---|---|---|---|
| 1 | Workspace boundary (`ScholarTrack_Europe` read-only) | No file under `../ScholarTrack_Europe` touched this checkpoint | — | — | Manual (no writes issued) | ✅ |
| 2 | Move catalogue from JSON to a verified DB | `src/lib/catalogue/db-repository.ts`, `app/api/opportunities/route.ts` | `drizzle/0001_init_schema.sql` | `tests/e2e/public-database-catalogue.spec.ts`, integration RLS tests | `checkpoint2:validate` (forbidden-import scan) | ✅ |
| 2 | Staff admin system | `app/staff/**`, `src/lib/db/actions/**` | — | e2e `staff-auth.spec.ts`, manual QA | `checkpoint2:validate` | ✅ |
| 2 | Only approved+published appear publicly | RLS public policy `status = 'published'`; `getPublishedOpportunities()` filters identically | `drizzle/0001_init_schema.sql` | `tests/integration/rls-policies.test.ts` | Manual + e2e (draft not visible) | ✅ |
| 3 | Current Next.js/Supabase/Drizzle/Zod/Docker APIs | `@supabase/ssr` (not deprecated auth-helpers), `getClaims()`, Drizzle 0.45 `pgPolicy`/`.enableRLS()`, Zod 4 | — | Typecheck + build | `npx tsc --noEmit`, `npm run build` | ✅ |
| 3 | Cloudflare adapter | Not applicable — this deployment targets Docker/Node hosting, not Cloudflare Workers; no Cloudflare-specific adapter was requested elsewhere in the repo | — | — | — | ⛔ (out of scope; no Cloudflare target exists in this project) |
| 4 | Env vars + validation module | `.env.example`, `src/lib/env.ts` | — | unit-covered indirectly via `isDatabaseConfigured`/`getServerEnv` usage in db-repository tests | `checkpoint2:validate` (NEXT_PUBLIC secret scan) | ✅ |
| 4 | Safe service-unavailable state | `isDatabaseConfigured()` gates `/`, `/opportunities`, `/opportunities/[slug]`; `EnvironmentConfigurationError` → generic 503 | — | Manual (unset env → page renders without count/crash) | Manual | ✅ |
| 5 | Local DB dev workflow | `docker-compose.yml` `db`/`db-test` services, `scripts/db-reset-test.ts`, `scripts/db/local-auth-shim.sql` | — | `npm run db:test` full suite | Manual + integration suite | ✅ |
| 6 | Relational schema (A–P) | `src/lib/db/schema/*.ts`, see `database-schema.md` | `drizzle/0001_init_schema.sql` | `tests/integration/*.test.ts` | `checkpoint2:validate` table-existence checks | ✅ |
| 7 | DB-layer constraints/indexes | CHECK constraints, unique indexes, 4 triggers | `drizzle/0001_init_schema.sql`, `drizzle/0002_publication_invariants.sql` | `tests/integration/publication-invariants.test.ts` | psql inspection + integration tests | ✅ |
| 8 | RLS + least privilege | Every table `.enableRLS()`; public/staff/service_role policies only, no anon/authenticated writes | `drizzle/0001_init_schema.sql`, `0002_publication_invariants.sql` | `tests/integration/rls-policies.test.ts` (7 cases incl. archived/merged visibility) | `checkpoint2:validate` | ✅ |
| 9 | Staff authentication | `app/staff/{login,logout,unauthorized}`, `app/staff/auth/callback`, middleware gating, `getClaims()` | — | e2e `staff-auth.spec.ts` (9 cases; 2 gated behind real credentials) | Manual with a real Supabase project | ✅ (auth flow); ⚠️ (live sign-in e2e requires real Supabase project — not executed, clearly skipped, not claimed) |
| 9 | Controlled admin bootstrap | `scripts/bootstrap-admin.ts` (idempotent, `--confirm`/`--force` gated, audited) | — | Manual (requires real Supabase) | `checkpoint2:validate` (script content checks) | ⚠️ not executed against a real project this session (no credentials available); logic verified by code review + structural checks |
| 10 | Role-based admin UI | `app/staff/(protected)/**`, `src/components/staff/StaffNav.tsx` | — | e2e + manual QA | `checkpoint2:validate` (14 required pages) | ✅ |
| 11 | Create/edit workflow | `OpportunityForm.tsx`, `updateOpportunityDraft` (creates a new version, never rewrites published history) | — | Manual QA | Manual | ✅ |
| 12 | Review/approval/publication + separation of duties | `src/lib/workflow/opportunity-workflow.ts`, `src/lib/db/actions/opportunities.ts` | Publication trigger | `tests/unit/opportunity-workflow.test.ts` (10 cases), `tests/unit/permissions.test.ts` (12 cases) | Manual QA end-to-end (draft→published) | ✅ |
| 13 | Public DB catalogue replaces JSON | `db-repository.ts`; `legacy-seed-repository.ts` confined to migration/tests | — | e2e, forbidden-import scan | `checkpoint2:validate` | ✅ |
| 13 | PWA caching rules | `public/sw.js` (`/staff`, `/api/staff` bypass), `useBuiltInOpportunities` stale/unavailable states | — | e2e `offline.spec.ts`, `staff-auth.spec.ts` (SW-cache test) | `checkpoint2:validate` | ✅ |
| 14 | Original 55-record migration | `scripts/import-legacy-scholarships.ts` (dry-run/import/rollback), `scripts/verify-migration.ts` | Data migration, not schema | `tests/integration/legacy-migration-cli.test.ts` (5 cases: dry-run, import, idempotent, rollback, re-import) | `npm run db:verify:migration` | ✅ |
| 15 | 100-record content target | See `content-expansion-gap.md` | — | — | — | ⛔ deferred — 55/100 real reviewed records exist; no fabricated content added (see gap doc for why and the path to 100) |
| 16 | Required-document management | `documents.ts` schema, `/staff/documents`, per-opportunity requirement editor | `drizzle/0001_init_schema.sql` | Manual QA | `checkpoint2:validate` | ✅ |
| 17 | Structured eligibility rules | `eligibility.ts` schema, per-opportunity rule editor, `/staff/eligibility-rules` cross-catalogue view | `drizzle/0001_init_schema.sql` | Manual QA | `checkpoint2:validate` | ✅ |
| 18 | CSV import/export | `src/lib/csv/*.ts`, `src/lib/db/actions/csv-import.ts`, `/staff/imports` | — | `tests/unit/csv-opportunity-import.test.ts` (17 cases: parsing, formula injection, prototype-pollution columns, row limits, schema validation) | Manual dry-run/commit QA | ✅ |
| 19 | Duplicate detection/merge | `src/lib/duplicates/detect.ts`, `src/lib/db/actions/duplicates.ts`, `/staff/duplicates` | — | `tests/unit/duplicate-detection.test.ts` (6 cases) | Manual QA | ✅ |
| 19 | pg_trgm | Not used — a dependency-free token-Jaccard fuzzy match was used instead, per the brief's "only when appropriate and supported" | — | covered by duplicate-detection unit tests | — | ⚠️ deliberate substitution, documented in `staff-roles-and-workflows.md` |
| 20 | Public correction reports | `src/lib/schemas/correction-report.ts`, `app/api/correction-reports/route.ts`, `ReportCorrectionDialog.tsx`, `/staff/corrections` | — | `tests/unit/correction-report-schema.test.ts` (9 cases), e2e `correction-report.spec.ts` (3 cases) | Manual QA | ✅ |
| 21 | Auditability | `audit_log` (DB-enforced append-only), `recordAuditEvent()` called from every mutating action | Trigger in `0002_publication_invariants.sql` | `tests/integration/publication-invariants.test.ts` (append-only case) | `/staff/audit` manual review | ✅ |
| 22 | API/server-side security | Zod at every mutation boundary, server-side auth on every action, sanitized redirects, no mass assignment, `server-only` guards | — | Covered indirectly by unit/integration suites | `checkpoint2:validate`, lint, typecheck | ✅ |
| 23 | Staff UX | Status labels, assignee/verification/history/diffs, confirmation on destructive actions, loading/empty states | — | Manual QA | Manual | ✅ |
| 24 | Public verification display | "Verification" section on detail page, separate from "Deadline"; badges never combined | — | e2e `public-database-catalogue.spec.ts` (asserts separate headings) | Manual QA | ✅ |
| 25 | A–N testing categories | See test files listed throughout this table plus `tests/unit/*.test.ts` (198 total incl. Checkpoint 1) and `tests/integration/*.test.ts` (19 total) | — | `npm run test`, `npm run db:test`, `npm run test:e2e` / Docker e2e profile | All green (see completion report) | ✅ (with the two credential-gated e2e cases in row 9 as the sole exception) |
| 26 | Package commands | See `package.json` scripts | — | — | `checkpoint2:validate` | ✅ |
| 27 | `checkpoint2:validate` | `scripts/validate-checkpoint2.ts` (348 checks) | — | Self-validating | `npm run checkpoint2:validate` | ✅ |
| 28 | Documentation | This file + 8 siblings under `docs/checkpoint-2/` + README updates | — | — | `checkpoint2:validate` (existence + length checks) | ✅ |
