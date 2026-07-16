# Checkpoint 3 traceability

Maps each requirement section from the Checkpoint 3 brief to its implementation, migration,
test, and validation method. Status legend: ✅ done and verified · ⚠️ done with a documented
limitation · ⛔ deferred (with reason).

| # | Requirement | Implementation | Migration | Test | Validation | Status |
|---|---|---|---|---|---|---|
| 2 | Guest mode continues; account is optional | `app/workspace/page.tsx` branches on `getStudentSession()`; `src/lib/storage/*` untouched | — | `tests/e2e/student-auth-and-sync.spec.ts` (guest describe block) | `checkpoint3:validate` (guest-file existence + no-login-required check) | ✅ |
| 2 | Migrate guest data into account | `src/lib/db/actions/student/sync.ts::applyGuestMigration`, `src/components/account/MigrationPanel.tsx` | `drizzle/0003_student_workspace.sql` | Manual QA (`checkpoint-3-manual-qa.md`) | `checkpoint3:validate` (migration module + "never deleted" copy check) | ✅ |
| 2 | Sync shortlist/stages/notes/checklists/deadlines/custom-opportunities/preferences | `src/hooks/useCloudWorkspace.ts`, `useCloudCustomOpportunities.ts`, `src/lib/db/actions/student/{tracking,notes,checklist,custom-opportunities,preferences}.ts` | `drizzle/0003_student_workspace.sql` | `tests/integration/student-workspace-rls.test.ts` (CRUD via each table) | `checkpoint3:validate` | ✅ |
| 2 | Same workspace across devices after login | `getMyTracking`/`getMyNotes`/etc. re-fetch on every mount, scoped to `studentProfileId` | — | e2e "workspace data persists after logout and login again" (credential-gated) | Manual QA | ✅ (auto-run subset); ⚠️ full cross-device check requires real Supabase test account, documented as credential-gated |
| 2 | Safe sign-out; guest/local data usable after | `app/auth/logout/route.ts`, `clearCloudWorkspaceLocalState()` clears only cloud cache/outbox | — | Manual QA | `checkpoint3:validate` | ✅ |
| 2 | Export/delete personal cloud data | `src/lib/db/actions/student/data-controls.ts` | — | Manual QA; unit tests for the underlying schema validator | `checkpoint3:validate` (export/import/deletion function checks) | ✅ |
| 2 | Privacy boundary understood | `app/privacy/page.tsx` (session-aware), `docs/checkpoint-3/privacy-and-data-controls.md` | — | — | `checkpoint3:validate` (privacy-page content checks) | ✅ |
| 2 | Graceful recovery: conflicts, offline, failed saves | `src/lib/sync/{status,outbox}.ts`, `useCloudWorkspace`'s conflict/failed states | — | `tests/unit/sync-outbox.test.ts`; e2e offline queue steps | `checkpoint3:validate` | ✅ |
| 3 | Student/staff auth separation | `getStudentSession()` vs `getStaffSession()`, independent middleware gates | — | e2e "student cannot access /staff"; integration "staff role does not automatically bypass" | `checkpoint3:validate` (cross-import checks between layouts) | ✅ |
| 3 | Safe redirects, no open redirect | `sanitizeNextPath` in `StudentLoginForm.tsx`/`middleware.ts`/`auth/callback/route.ts` (rejects `/staff`, `//`, `://`) | — | e2e redirect-param test | `checkpoint3:validate` | ✅ |
| 3 | No secret keys in frontend; no client-supplied role trust | `createSupabaseAdminClient()` server-only; every action re-derives identity from `getClaims()` | — | Manual code review | `checkpoint3:validate` (NEXT_PUBLIC secret scan reused from Checkpoint 2's validator, still passing) | ✅ |
| 3 | Email/password auth; email-confirmation documented | `StudentSignupForm.tsx`; `student-auth-and-sync.md` §1–2 | — | Manual QA | — | ✅ |
| 4 | `student_profiles` (A) | `src/lib/db/schema/student.ts` | `drizzle/0003_student_workspace.sql` | `tests/unit/student-workspace-schemas.test.ts`; integration RLS test | `checkpoint3:validate` | ✅ |
| 4 | `user_opportunity_tracking` (B) | same | same | same + tracking CRUD integration test | `checkpoint3:validate` | ✅ |
| 4 | `user_custom_opportunities` (C) | same | same | integration test; never-verified invariant by construction (no FK to verification tables) | `checkpoint3:validate` | ✅ |
| 4 | `user_notes` (D) | same | same | integration test; plain-text-only enforced in UI (no `dangerouslySetInnerHTML` anywhere in `CloudTrackedItem.tsx`) | `checkpoint3:validate` | ✅ |
| 4 | `user_checklist_tasks` (E) | same | same | integration test | `checkpoint3:validate` | ✅ |
| 4 | `user_planning_preferences` (F) | same | same | schema unit test | `checkpoint3:validate` | ✅ |
| 4 | `user_display_preferences` (G) | same | same | schema unit test | `checkpoint3:validate` | ✅ |
| 4 | `user_sync_state` (H) | same | same | unit test (outbox/status) | `checkpoint3:validate` | ✅ |
| 4 | `user_data_requests` (I) | same | same | integration test (append-only) | `checkpoint3:validate` | ✅ |
| 5 | RLS: owner read/insert/update/delete only | `ownerAllPolicy`/`ownerReadInsertPolicies` in `common.ts` | `drizzle/0003…`, `0004_student_workspace_grants.sql` | `tests/integration/student-workspace-rls.test.ts` (13 cases) | `checkpoint3:validate` | ✅ |
| 5 | Anonymous cannot read student data | `REVOKE SELECT … FROM anon` in `0004_student_workspace_grants.sql` | same | integration test (expects "permission denied") | `checkpoint3:validate` | ✅ |
| 5 | Cross-student access denied | owner-only policies | `drizzle/0003…` | integration test (profile/tracking/notes/checklist/custom-opportunity cross-user cases) | `checkpoint3:validate` | ✅ |
| 5 | Staff no automatic broad access | No staff-select policy on any student table | `drizzle/0003…` | integration test "staff role does not automatically bypass student profile privacy" | `checkpoint3:validate` | ✅ |
| 6 | Local-to-cloud sync design, preview, merge/replace/copy | `src/lib/db/actions/student/sync.ts`, `MigrationPanel.tsx` | — | Manual QA | `checkpoint3:validate` | ✅ |
| 6 | Dedup by stable IDs | Guest-generated UUIDs reused as cloud PKs (checklist items, custom opportunities) | — | Manual QA (idempotent re-migration step) | — | ✅ |
| 6 | Sync status UI (Saved/Saving/Offline/Paused/Failed/Conflict/last synced) | `src/lib/sync/status.ts`, `SyncStatusIndicator.tsx` | — | Manual QA | `checkpoint3:validate` | ✅ |
| 7 | Offline-first account experience | `src/lib/sync/{outbox,cloud-cache}.ts`, IndexedDB `cloudCache`/`syncOutbox` stores | `src/lib/storage/db.ts` schema v3 | `tests/unit/sync-outbox.test.ts` | `checkpoint3:validate` | ✅ |
| 7 | Staff/private pages never cached offline | `public/sw.js` pathname exclusions for `/staff`, `/api/staff`, `/account`, `/api/account`, `/auth` | — | e2e "account pages are never served from the service worker cache while offline" | `checkpoint3:validate` | ✅ |
| 7 | Signed-in data never leaks to another browser user | `Cache-Control: no-store` on session-aware public pages (middleware) + SW respecting it; cache/outbox cleared on sign-out | — | Manual QA | `checkpoint3:validate` | ✅ |
| 8 | `/workspace` upgraded for guest + signed-in | `app/workspace/page.tsx`, `CloudWorkspaceView.tsx`, `AccountStatusBanner.tsx` | — | e2e guest + signed-in describe blocks | `checkpoint3:validate` | ✅ |
| 9 | `/account` dashboard + settings forms, Zod-validated | `app/account/page.tsx`, `ProfileForm.tsx`, `src/lib/schemas/student-workspace.ts` | — | schema unit tests (invalid/sensitive-field rejection) | `checkpoint3:validate` | ✅ |
| 10 | Cloud data export | `exportMyData()`, `CloudDataSection.tsx` | — | schema unit tests; e2e download test (credential-gated) | `checkpoint3:validate` | ✅ |
| 11 | Cloud data import (validate, reject malformed/oversized/polluted, merge/replace) | `importMyAccountData()`, `validateCloudExportPayload()` | — | `tests/unit/cloud-export-schema.test.ts` (6 cases) | `checkpoint3:validate` | ✅ |
| 12 | Account data deletion (workspace-only + full account) | `deleteMyWorkspaceData()`, `deleteMyAccount()`, `DeleteAccountSection.tsx` | — | Manual QA | `checkpoint3:validate` | ✅ |
| 13 | Checkpoint 2 regression | Staff files untouched; public repository untouched | — | Full existing unit/integration suite re-run (229 unit, 32 integration) | `checkpoint0/1/2:validate` all still passing | ✅ |
| 15 | Privacy page update | `app/privacy/page.tsx` | — | — | `checkpoint3:validate` (content checks) | ✅ |
| 16 | Auth/RLS/profile/tracking/migration/offline/export/deletion/regression tests | See rows above; 31 new unit + 13 new integration + 14 new e2e (×2 projects) | — | — | `npm run test`, `npm run db:test`, `npm run test:e2e` | ✅ |
| 17 | `checkpoint3:validate` + preserved commands | `scripts/validate-checkpoint3.ts`, `package.json` | — | Self-validating | `npm run checkpoint3:validate` | ✅ |
| 19 | Documentation (5 new files + README) | This file + 5 siblings + README updates | — | — | `checkpoint3:validate` (existence + length checks) | ✅ |

## Deferred / documented limitations

| Item | Reason | Where documented |
| --- | --- | --- |
| Catalogue/detail-page quick-shortlist button stays guest-local regardless of sign-in state | Scope containment — touching the shared `OpportunityCard`/`OpportunityDetailBody` components risked Checkpoint 1/2 regressions under this checkpoint's time budget | `checkpoint-3-architecture.md` §Sync architecture |
| Cloud custom-opportunity creation uses a compact quick-add form, not the full guest `CustomOpportunityForm` | The guest form navigates to `/opportunities/[slug]`, a route with no cloud-custom-opportunity detail page yet | `CloudCustomOpportunityQuickAdd.tsx` docstring |
| Custom-opportunity edits are not queued offline (tracking/notes/checklist are) | Lower edit frequency than shortlist/notes/checklist; documented scope cut, not an oversight | `useCloudCustomOpportunities.ts` docstring |
| Live cross-tab/cross-device push sync | Out of scope — sync is fetch-on-mount, not a realtime subscription | `student-auth-and-sync.md` troubleshooting section |
| Full `src/lib/domain/user-profile.ts` contract (education/work/research/publications/certifications/language-test records) | The Checkpoint 3 brief's own profile spec (section 4A) is narrower and explicitly says "keep minimal" | `checkpoint-3-architecture.md` §Database tables |
