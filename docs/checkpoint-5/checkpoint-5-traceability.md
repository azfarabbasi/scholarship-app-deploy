# Checkpoint 5 traceability

Maps each requirement area from the Checkpoint 5 brief to its implementation, migration, test, and
validation method. Status legend: ✅ done and verified · ⚠️ done with a documented limitation ·
⛔ deferred (with reason).

| Requirement area | Implementation | Migration | Test | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| AI provider abstraction, pluggable, mock always safe | `src/lib/ai/providers/{types,mock,groq,index}.ts` | — | `tests/unit/ai-mock-provider.test.ts` (7), `tests/unit/ai-groq-provider.test.ts` (4) | `checkpoint5:validate` | ✅ |
| AI config disabled by default, never breaks build, no NEXT_PUBLIC secret | `src/lib/ai/config.ts` (isolated from `getServerEnv()`) | — | `tests/unit/ai-config.test.ts` (7) | `checkpoint5:validate` | ✅ |
| AI disabled/unavailable graceful UI | `isAiAvailableAction()`, `askAssistant()`'s `"unavailable"` kind, `/assistant` page conditional render | — | Manual QA §1; e2e "1. staff can disable…" | `checkpoint5:validate` | ✅ |
| RAG/source tables + migrations | `src/lib/db/schema/ai.ts` (13 tables) | `drizzle/0007_ai_assistant.sql`, `0008_ai_grants_and_search.sql` | `tests/integration/ai-rls.test.ts` | `checkpoint5:validate`, `db:check` | ✅ |
| RLS on every AI table, including forged-parent-id defense | Bespoke `pgPolicy` on `ai_messages`/`ai_answer_citations`/`ai_retrieval_events`/`ai_feedback` (EXISTS-checks the parent), read-only `ai_usage_limits` policy | `drizzle/0009_ai_owner_policy_fix.sql` | `tests/integration/ai-rls.test.ts` (20 cases) | `db:test` | ✅ |
| Public retrieval excludes unpublished/staff/private data | `src/lib/ai/rag/retrieval.ts` (`status='approved'` + published-opportunity join) | same | `tests/integration/ai-rls.test.ts` (anon-approved-only cases) | `checkpoint5:validate`, manual retrieval smoke test | ✅ |
| Full-text retrieval (no embeddings dependency) | `chunk_text_search` generated tsvector column + GIN index; ILIKE fallback | `drizzle/0008_ai_grants_and_search.sql` | Manual smoke-tested against real fixture data (documented in architecture doc) | `checkpoint5:validate` | ✅ |
| pgvector structural allowance | Exception-guarded `CREATE EXTENSION vector` + `embedding` column | same | — | `checkpoint5:validate` | ⚠️ structural only, not populated (documented) |
| Document→chunk model, staff approval lifecycle | `src/lib/ai/rag/chunking.ts`, `src/lib/db/actions/ai-staff.ts` | — | Manual QA §"Staff source management" | `checkpoint5:validate` | ✅ |
| Citations (opportunity, source, verification, checked-date, link) | `src/lib/ai/rag/citations.ts`, `AssistantChat.tsx`'s `CitationList` | — | `tests/unit/ai-citations.test.ts` (5) | `checkpoint5:validate` | ✅ |
| Pre-flight safety: hidden-prompt/secret/other-user-data/injection/invented-fact | `src/lib/ai/safety/intent-classifier.ts` | — | `tests/unit/ai-safety.test.ts`; `ai:safety:test` (5 cases) | `checkpoint5:validate`, `npm run ai:safety:test` | ✅ |
| Source-text injection neutralization | `src/lib/ai/safety/neutralize-source.ts` | — | `tests/unit/ai-safety.test.ts` | `checkpoint5:validate` | ✅ |
| Output validation: no guarantees, no invented dates, secret redaction | `src/lib/ai/safety/validate-output.ts` | — | `tests/unit/ai-safety.test.ts` | `checkpoint5:validate`, `npm run ai:evaluate` | ✅ |
| Rate limiting: guest cookie, signed-in DB counter, no unlimited abuse | `src/lib/ai/rate-limit/{guest,user}.ts` | `ai_usage_limits` table | `tests/unit/ai-rate-limit-guest.test.ts` (5); smoke-tested end-to-end (see conversation record) | `checkpoint5:validate` | ✅ |
| Assistant orchestration (single entry point) | `src/lib/ai/assistant.ts` (`askAssistant()`) | — | Smoke-tested end-to-end (config→classification→retrieval→provider→validation→citations) | `checkpoint5:validate` | ✅ |
| `/assistant`, `/assistant/history`, `/assistant/settings` | `app/assistant/**` | — | e2e "2","3","4","8" scenarios (browser-verified) | `checkpoint5:validate` | ✅ |
| Opportunity-detail AI panel | `OpportunityAssistantPanel.tsx`, wired into `OpportunityDetailBody.tsx` | — | e2e "5","6" scenarios (browser-verified) | `checkpoint5:validate` | ✅ |
| Comparison assistant | Wired into `ComparisonView.tsx` | — | Manual QA §"Comparison assistant" | `checkpoint5:validate` | ✅ |
| Workspace assistant (never sends private notes/checklist text) | `WorkspaceAssistantView.tsx`, `app/workspace/assistant/page.tsx` | — | Manual QA §"Workspace assistant" (payload-inspection step) | `checkpoint5:validate` | ✅ |
| Matching-explanation surface | Folded into the opportunity-detail panel via `matchResults` prop (explains, never recomputes) | — | e2e "5. refuses a final-eligibility guarantee" | `checkpoint5:validate` | ✅ |
| Staff AI source management, requires staff role | `app/staff/(protected)/ai/sources/page.tsx`, `canManageAiSources`/`canApproveAiSources` | — | e2e "11. staff can access AI source management" (auth-gated) | `checkpoint5:validate` | ✅ |
| Staff retrieval coverage inspection | `getAiRetrievalCoverageReport()`, `/staff/ai` dashboard | — | Manual QA §"Staff source management" step 7 | `checkpoint5:validate` | ✅ |
| Staff evaluation harness UI + CLI | `/staff/ai/evaluations`, `triggerAiEvaluationRun()`, `scripts/ai-evaluate.ts` | — | 15/15 cases pass (real run) | `npm run ai:evaluate`, `checkpoint5:validate` | ✅ |
| Staff usage/audit dashboard | `/staff/ai/usage`, `getAiUsageSummary()`, `listAiFeedback()` | — | Manual QA | `checkpoint5:validate` | ✅ |
| Staff safety log, Administrator-only | `/staff/ai/safety`, `canViewAiSafetyLog` | — | `tests/integration/ai-rls.test.ts` (staff-can-read case) | `checkpoint5:validate` | ✅ |
| Runtime kill switch, Administrator-only | `ai_provider_health.manually_disabled`, `AiKillSwitch.tsx` | — | e2e "1." (auth-gated) | `checkpoint5:validate` | ✅ |
| AI feedback (helpful/incorrect/etc.), RLS-protected, staff-visible | `submitAiFeedback()`, `ai_feedback` dual owner+staff RLS | `drizzle/0007…sql` | `tests/integration/ai-rls.test.ts` (feedback cases) | `checkpoint5:validate` | ✅ |
| Conversation storage: guest local by default, signed-in opt-in | `src/lib/storage/ai-assistant.ts` (IndexedDB v5), `getMyAiHistoryEnabled`/`setMyAiHistoryEnabled` | — | `tests/unit/ai-assistant-storage.test.ts` (5) | `checkpoint5:validate` | ✅ |
| Temporary chat mode | `temporary` flag threaded through `useAssistantChat`/`askAssistantAction` — skips both guest-local and cloud persistence | — | Manual QA §"Temporary chat" | `checkpoint5:validate` | ✅ |
| Privacy page updated, no longer claims "no AI" | `app/privacy/page.tsx` "The AI assistant" section | — | Manual QA §"Privacy controls" | `checkpoint5:validate` (content checks) | ✅ |
| Account export/delete includes AI data when enabled | `src/lib/db/actions/student/data-controls.ts`, `src/lib/schemas/cloud-export.ts` | — | Manual QA §"History clear/delete" | `checkpoint5:validate` | ✅ |
| Guest backup export opt-in for AI history | `BackupSection.tsx` checkbox, `buildBackupPayload({includeAiHistory})` | — | `tests/unit/backup.test.ts` (unchanged, still 22 passing) | `checkpoint5:validate` | ✅ |
| Service worker/middleware never cache AI or staff-AI routes unsafely | `middleware.ts` (`/assistant` added to `SESSION_AWARE_PUBLIC_PREFIXES`), `public/sw.js` (blanket `/staff` exclusion already covers `/staff/ai/**`) | — | Manual QA §"Offline/PWA regression" | `checkpoint5:validate` | ✅ |
| No sensitive document upload added anywhere in the AI surface | No `type="file"` input in any assistant/staff-AI component | — | — | `checkpoint5:validate` (grep check) | ✅ |
| Evaluation harness: 15 fixture cases, deterministic | `src/lib/ai/evaluation/{cases,harness}.ts` | — | `npm run ai:evaluate` (15/15, real run) | `checkpoint5:validate` | ✅ |
| `ai:evaluate`/`ai:safety:test`/`ai:sources:reindex` commands | `scripts/ai-evaluate.ts`, `scripts/ai-safety-test.ts`, `scripts/ai-sources-reindex.ts` | — | All three run successfully (real runs) | `checkpoint5:validate` | ✅ |
| `checkpoint5:validate` (meaningful) + preserved commands | `scripts/validate-checkpoint5.ts` (136 checks) | — | Self-validating: 129/129 non-doc checks pass | `npm run checkpoint5:validate` | ✅ |
| Documentation (7 files + README) | This file + 6 siblings + README updates | — | — | `checkpoint5:validate` (existence checks) | ✅ |
| Regression: guest/catalogue/staff-admin/matching/reminders/PWA untouched | No changes to `src/lib/matching/engine.ts`, `src/lib/deadlines/**`, `src/lib/reminders/**`; one unrelated pre-existing bug fixed (see below) | — | Full unit suite (400 passed / 1 skipped), full integration suite (75 passed) | `npm run test`, `npm run db:test` | ✅ |

## Bugs found and fixed during this checkpoint (not requirements, but material to correctness)

1. **Cross-user AI data injection via RLS** — `ai_messages`/`ai_answer_citations`/
   `ai_retrieval_events`/`ai_feedback`'s RLS policies originally checked only
   `student_profile_id = auth.uid()`, not that the referenced parent row (conversation/message) was
   also owned by the caller. A student could otherwise forge a `conversation_id`/`message_id`
   pointing at another student's data while keeping their own `student_profile_id`. Fixed with an
   `EXISTS` sub-clause in each policy's `USING`/`WITH CHECK`. Caught by
   `tests/integration/ai-rls.test.ts`, which failed on first run before the fix.
2. **Mock provider self-triggering on its own rules text** — `MockAiProvider` originally scanned
   *every* system message for `<source`/`<structured-fact` tags, including the rules message that
   *mentions* those tag names while explaining them — causing a false "sources present" detection
   with zero real context. Found via manual browser QA, fixed by scanning only the last system
   message (the actual context block), with a regression test added.
3. **`useComparisonSelection`'s `getServerSnapshot()` returned a fresh `[]` each call** — violates
   `useSyncExternalStore`'s snapshot-stability contract, causing a React console error on `/compare`
   (pre-existing from Checkpoint 4, unrelated to this checkpoint's own code, found while browser-
   testing the new comparison assistant panel on that same page). Fixed with a single cached empty
   array reference.
4. **`/assistant` was cacheable-and-replayable offline** — initially given the same guest
   "cacheable, revalidate-when-online" treatment as `/opportunities`/`/workspace` in
   `middleware.ts`, but unlike those pages the assistant has zero offline functionality. Only
   surfaced by the real Docker e2e run (dev mode never activates the service worker at all). Fixed
   with a dedicated, always-`no-store` rule for `/assistant`/`/workspace/assistant`.
5. **The offline e2e test's `response.ok()` assertion couldn't distinguish a real page load from a
   service-worker-served offline-fallback page** (also HTTP 200) — rewritten to assert on the
   rendered "You're offline" heading instead, plus a `navigator.serviceWorker.controller` wait to
   eliminate a `clients.claim()` timing race reproduced on both e2e projects.

## Deferred / documented limitations

- **pgvector/embeddings**: structural only (extension + column), not populated — no embeddings
  provider key is part of the Checkpoint 5 env var contract. Full-text search is the sole working
  retrieval mechanism.
- **Sentence-level citation attribution**: citations are retrieval-level (everything placed in the
  prompt becomes a citation candidate), not matched to the specific sentence they support.
- **Guest feedback**: not sent to staff — requires a persisted, history-enabled message. Documented
  in the safety policy and manual QA.
- **Cloud import of AI history**: account export includes AI history when enabled; the import path
  restores every other section but not AI conversations (scope-contained deliberately).
