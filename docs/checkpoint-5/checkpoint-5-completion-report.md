# Checkpoint 5 completion report

## Summary

A source-grounded AI assistant — general/opportunity/comparison/workspace assistant surfaces for
students, a matching-explanation view folded into the opportunity panel, and a full staff
management/evaluation/safety toolchain — added on top of every prior checkpoint without changing
any of them. AI is off by default (`AI_ENABLED=false`); the rest of the app is unaffected whether
it's configured or not.

## Features delivered

- **Provider abstraction**: `mock` (deterministic, network-free, used by every test) and `groq`
  (real OpenAI-compatible chat-completions call), pluggable via `AI_PROVIDER`.
- **RAG pipeline**: full-text search (PostgreSQL `tsvector`/GIN, no embeddings dependency) over
  staff-approved source excerpts, plus deterministic structured facts (deadline/eligibility/
  funding/document data) from the same repository the public catalogue uses.
- **Three-layer safety**: pre-flight intent classification (hidden-prompt/secret/other-user-data/
  injection/invented-fact refusal, before any provider call), source-text injection neutralization,
  and post-generation output validation (strips eligibility/admission guarantees, redacts
  secret-shaped strings).
- **Citations**: every factual answer cites its opportunity/source, with verification status,
  checked date, and an official link when available, distinguishing official-source/structured-
  data/workspace-context/match-explanation citation types.
- **Rate limiting**: signed guest cookie (no anonymous-device table), durable read-only signed-in
  DB counter.
- **Privacy**: guest-local-by-default (IndexedDB, schema v5), signed-in opt-in history, temporary
  chat mode (nothing stored anywhere), clear/delete controls, opt-in inclusion in guest/account
  exports, deletion cascades with account/workspace deletion.
- **Student surfaces**: `/assistant`, `/assistant/history`, `/assistant/settings`, an
  opportunity-detail panel, a comparison-view panel, `/workspace/assistant`.
- **Staff surfaces**: `/staff/ai` (dashboard + runtime kill switch), `/staff/ai/sources` (source
  excerpt management with a draft→approved/rejected/stale lifecycle), `/staff/ai/evaluations`
  (harness runner + history), `/staff/ai/usage` (usage + feedback), `/staff/ai/safety` (safety
  event log, Administrator-only).
- **Evaluation harness**: 15 deterministic fixture cases (`npm run ai:evaluate`), a 5-case
  safety-only subset (`npm run ai:safety:test`), and a reindex CLI (`npm run ai:sources:reindex`).

## Routes created

Student: `/assistant`, `/assistant/history`, `/assistant/settings`, `/workspace/assistant` (plus
an embedded panel on `/opportunities/[slug]` and `/compare`, not separate routes).
Staff: `/staff/ai`, `/staff/ai/sources`, `/staff/ai/evaluations`, `/staff/ai/usage`,
`/staff/ai/safety`.

## Database

**13 new tables** (`ai_source_documents`, `ai_source_chunks`, `ai_prompt_templates`,
`ai_conversations`, `ai_messages`, `ai_answer_citations`, `ai_retrieval_events`, `ai_feedback`,
`ai_safety_events`, `ai_evaluation_cases`, `ai_evaluation_runs`, `ai_usage_limits`,
`ai_provider_health`) across three migrations:

- `drizzle/0007_ai_assistant.sql` — Drizzle-generated: tables, enums, RLS enablement, FKs.
- `drizzle/0008_ai_grants_and_search.sql` — hand-authored: authenticated/anon grant baseline,
  `tsvector` generated column + GIN index for chunk full-text search, exception-guarded pgvector.
- `drizzle/0009_ai_owner_policy_fix.sql` — hand-authored: hardens four tables' RLS policies to
  also verify the referenced parent row's ownership (see "Bugs found," below).

**RLS**: owner-only (`ai_conversations`/`ai_messages`/`ai_answer_citations`/`ai_retrieval_events`,
each additionally EXISTS-checking the parent's ownership); public+staff, gated on
`status='approved'` and a published opportunity (`ai_source_documents`/`ai_source_chunks`);
staff-only (`ai_prompt_templates`/`ai_evaluation_cases`/`ai_evaluation_runs`/`ai_provider_health`);
staff+service-role (`ai_safety_events`); owner+staff (`ai_feedback` — deliberate, matching the
`correction_reports` precedent); read-only owner (`ai_usage_limits` — a hand-written policy with no
insert/update grant, so a student can never reset their own quota).

## AI provider setup

`AI_ENABLED=false` by default. Set `AI_PROVIDER=mock` for a fully working, offline-safe assistant
with no key, or `AI_PROVIDER=groq` + `GROQ_API_KEY` for a real model. See
[docs/checkpoint-5/checkpoint-5-architecture.md](checkpoint-5-architecture.md) and the updated
`.env.example`.

## RAG/source strategy, citations, safety, rate limiting, privacy/history

See [checkpoint-5-architecture.md](checkpoint-5-architecture.md),
[ai-safety-policy.md](ai-safety-policy.md), and [rag-source-management.md](rag-source-management.md)
for full detail on each.

## AI feedback

`submitAiFeedback()` requires a signed-in student and a persisted (history-enabled) message;
visible to staff on `/staff/ai/usage` regardless of the submitting student, matching the
`correction_reports` precedent. RLS-protected (`tests/integration/ai-rls.test.ts`).

## AI evaluation results (real runs, not claimed)

```
npm run ai:evaluate       → 15/15 passed
npm run ai:safety:test    → 5/5 passed
```

## Tests added

- **56 new unit tests**: `ai-safety` (13), `ai-mock-provider` (7, incl. a regression case), `ai-groq-
  provider` (4), `ai-chunking` (6), `ai-citations` (5), `ai-rate-limit-guest` (5), `ai-config` (7),
  `ai-assistant-storage` (5), plus 4 in other pre-existing files exercising updated backup/cloud-
  export logic.
- **20 new integration tests**: `tests/integration/ai-rls.test.ts` — public source visibility
  (approved vs. draft), owner-only conversation/message/citation/retrieval-event access, dual
  owner+staff feedback access, read-only usage-limits, staff-only internal tables.
- **12 new e2e scenarios**: `tests/e2e/ai-assistant.spec.ts` — disabled-state grace, sourced
  answers, citations, deadline/eligibility refusals, opportunity-panel scoping, feedback, guest
  history clearing, signed-in history settings, staff/student route separation, staff source
  management, offline behaviour. Guest-flow scenarios use the mock provider and real published
  fixture data; account-requiring scenarios are gated behind `E2E_STUDENT_EMAIL`/`E2E_STAFF_EMAIL`,
  matching the existing suite's convention.

## Data validation result

```
npm run data:validate
```
**PASSED** — 55/55 records schema-valid, 0 schema issues, 0 duplicate groups.

## Deadline audit result

```
npm run deadlines:audit
```
**PASSED WITH WARNINGS** — 55 records audited, 0 structural findings, 5 warning groups (the same
pre-existing, documented warning pattern from Checkpoint 4 — nothing new).

## Checkpoint 0–5 validator results

```
npm run checkpoint0:validate   → 1499 checks passed
npm run checkpoint1:validate   → 76 checks passed
npm run checkpoint2:validate   → 471 checks passed
npm run checkpoint3:validate   → 118 passed / 2 failed (expected, cosmetic — see below)
npm run checkpoint4:validate   → 130 passed / 3 failed (expected, cosmetic — see below)
npm run checkpoint5:validate   → 136 checks passed / 0 failed
```

### Expected, cosmetic-only earlier-checkpoint validator staleness

Same phenomenon already documented in `docs/checkpoint-4/checkpoint-4-completion-report.md` for
`checkpoint3:validate`, now also affecting `checkpoint4:validate`:

- `checkpoint3:validate`'s two failures both check for literal substrings ("Checkpoint 3" as a
  freshness marker; "AI is not used") that the privacy page, by design, can only say for the
  *current* checkpoint. The page now correctly says "Last reviewed for Checkpoint 5" and describes
  the AI assistant instead — advancing the marker forward is the intended behaviour, not a
  regression in the underlying guarantee.
- `checkpoint4:validate`'s three failures are the same pattern: the guest-storage
  `SCHEMA_VERSION` correctly advanced from 4 to 5 (Checkpoint 5 added two new IndexedDB stores),
  and the privacy-page freshness marker/AI-not-used text advanced the same way as above.
- `checkpoint0:validate`, `checkpoint1:validate`, and `checkpoint2:validate` all still pass with
  zero failures — nothing in Checkpoint 5 touched what they check.

## Database test result

```
npm run db:check           → "Everything's fine"
npm run db:test            → 75/75 passed (55 pre-existing + 20 new AI RLS tests)
npm run db:verify:migration → "No issues found"
```

## E2E test result

```
docker compose --profile test run --rm e2e
```
**137 passed / 33 skipped / 0 failed** (real Docker run, production build, both `chromium-desktop`
and `mobile` projects — 170 tests total). The 33 skips are the pre-existing, credential-gated
staff/student/cross-user scenarios (no `E2E_STAFF_EMAIL`/`E2E_STUDENT_EMAIL`/etc. configured in
this environment) plus this checkpoint's own 10 credential-gated additions (2 staff + 3 student
scenarios × 2 browser projects) — every one of them reports a clear skip reason, never a false
pass. All 12 named Checkpoint 5 scenarios that *can* run without real credentials passed, including
the offline scenario after two real fixes this run surfaced (see "Bugs found," below).



## Typecheck result

```
npm run typecheck
```
**PASSED** — zero errors.

## Lint result

```
npm run lint
```
**PASSED** — zero errors, zero warnings (two unused-parameter warnings in `src/lib/db/schema/ai.ts`
found and fixed during this session).

## Build result

```
npm run build
```
**PASSED** — production build compiled and typechecked successfully; every new route
(`/assistant`, `/assistant/history`, `/assistant/settings`, `/workspace/assistant`, `/staff/ai`,
`/staff/ai/sources`, `/staff/ai/evaluations`, `/staff/ai/usage`, `/staff/ai/safety`) appears in the
route manifest. One pre-existing, unrelated warning: Next.js's "middleware" naming deprecation
notice (suggests renaming to "proxy" in a future version) — not introduced by this checkpoint.

## Known warnings

- The Next.js "middleware" → "proxy" naming deprecation notice at build time (pre-existing,
  unrelated to Checkpoint 5).
- `checkpoint3:validate`/`checkpoint4:validate`'s expected, cosmetic staleness (documented above).

## Bugs found and fixed during this session

1. **Cross-user AI data injection via RLS** (real security finding): `ai_messages`/
   `ai_answer_citations`/`ai_retrieval_events`/`ai_feedback`'s original RLS policies checked only
   `student_profile_id = auth.uid()`, not that the referenced parent row was also owned by the
   caller — a student could otherwise forge a `conversation_id`/`message_id` pointing at another
   student's data while keeping their own `student_profile_id`, since the policy's `WITH CHECK`
   would still pass. Caught by `tests/integration/ai-rls.test.ts` failing on first run. Fixed with
   an `EXISTS` sub-clause added to each policy (`drizzle/0009_ai_owner_policy_fix.sql`).
2. **Mock provider false "sources present" detection**: `MockAiProvider` originally scanned every
   system message for `<source`/`<structured-fact` tags, including the rules message that mentions
   those tag names while explaining them — producing a confident-sounding answer with zero real
   context. Found via manual browser QA; fixed by scanning only the actual context message, with a
   regression test added.
3. **`useComparisonSelection`'s `getServerSnapshot()`** returned a fresh `[]` on every call,
   violating `useSyncExternalStore`'s snapshot-stability contract and producing a React console
   error on `/compare` — pre-existing from Checkpoint 4 (a different function in the same file,
   `readIds()`, was already fixed for the same class of bug back then; this one was missed), found
   while browser-testing the new comparison-assistant panel on that page. Fixed with a single
   cached empty-array reference.
4. **`/assistant` was reachable offline from a stale cache** — it was initially added to
   `middleware.ts`'s `SESSION_AWARE_PUBLIC_PREFIXES`, giving guests the same "cacheable, revalidate
   when online" treatment as `/opportunities`/`/workspace`. Unlike those pages, the assistant has
   zero useful offline functionality (every feature is a live Server Action), so letting the
   service worker legitimately cache and replay its shell offline was wrong. Found by the real
   Docker e2e run's offline scenario (passed locally in dev mode, where the service worker never
   activates, so this could only be caught against a genuine production build). Fixed by giving
   `/assistant`/`/workspace/assistant` a dedicated, always-`no-store` rule
   (`ALWAYS_NO_STORE_PREFIXES`) independent of sign-in state.
5. **The e2e offline test's own assertion was unreliable**: it checked `response.ok()`, but a
   service-worker-served offline-fallback page is *also* a normal 200 response — that check can't
   distinguish "the real page loaded" from "the honest offline fallback loaded instead." Rewrote it
   to assert on the actually-rendered "You're offline" heading. A related flake (checking
   `registration.active.state === "activated"`, which doesn't guarantee `clients.claim()` has
   finished attaching the worker as *this* page's controller yet) was fixed by waiting on
   `navigator.serviceWorker.controller` after one reload, eliminating an intermittent failure
   reproduced identically on both `chromium-desktop` and `mobile`.

## Files created (selected, non-exhaustive)

`src/lib/ai/**` (config, providers, safety, rate-limit, rag, evaluation, assistant.ts,
token-estimate.ts), `src/lib/db/schema/ai.ts`, `src/lib/db/actions/ai-staff.ts`,
`src/lib/db/actions/student/ai-assistant.ts`, `src/lib/storage/ai-assistant.ts`,
`src/hooks/useAssistantChat.ts`, `src/components/assistant/**`, `src/components/staff/Ai*.tsx`,
`app/assistant/**`, `app/workspace/assistant/**`, `app/staff/(protected)/ai/**`,
`drizzle/0007-0009_*.sql`, `scripts/ai-evaluate.ts`, `scripts/ai-safety-test.ts`,
`scripts/ai-sources-reindex.ts`, `scripts/validate-checkpoint5.ts`, `tests/unit/ai-*.test.ts`,
`tests/integration/ai-rls.test.ts`, `tests/e2e/ai-assistant.spec.ts`, this documentation set.

## Files modified (selected, non-exhaustive)

`src/lib/db/schema/{enums,index}.ts`, `src/lib/auth/permissions.ts`,
`src/components/staff/StaffNav.tsx`, `src/components/layout/nav-items.ts`,
`src/components/opportunities/{OpportunityDetailBody,ComparisonView}.tsx`,
`src/components/settings/BackupSection.tsx`, `src/lib/storage/{backup,types,db,events}.ts`,
`src/lib/schemas/cloud-export.ts`, `src/lib/db/actions/student/data-controls.ts`,
`src/lib/supabase/middleware.ts`, `public/sw.js`, `app/privacy/page.tsx`, `app/workspace/page.tsx`,
`app/compare/page.tsx`, `app/opportunities/[slug]/page.tsx`, `.env.example`, `package.json`,
`docker-compose.yml`, `README.md`, `src/hooks/useComparisonSelection.ts` (bug fix, see above).

## Confirmations

- The assistant is source-grounded (approved excerpts + structured catalogue data only) and never
  a final eligibility, admission, or funding authority — enforced by the pre-flight classifier, the
  system prompt, and the post-generation output validator independently, verified by the
  evaluation harness and integration tests.
- No sensitive-file upload feature was added anywhere — every AI surface is text-only chat;
  `checkpoint5:validate` greps for `type="file"` across every assistant/staff-AI component.

## Honesty notes

- Everything in this report reflects commands actually run during this session, not assumed
  results — including the two real bugs the automated test suites themselves caught before being
  fixed.
- pgvector/embeddings, sentence-level citation attribution, guest-visible-to-staff feedback, and
  cloud-import of AI history are explicitly documented as not implemented/limited in scope — see
  "Known limitations" in [checkpoint-5-architecture.md](checkpoint-5-architecture.md).
