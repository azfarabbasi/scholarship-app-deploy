# Launch audit remediation — Phase 3: Scholarly AI

Fixes every Phase 3 item from the launch-blocker audit: the assistant now never calls a
provider without evidence, every factual claim must map to a real, validated evidence id,
deadline/eligibility questions are answered from a fixed deterministic template instead of
an LLM, retrieval scoping and source-content safety were hardened, and the two remaining
non-atomic operations (source-document/chunk lifecycle, signed-in rate limiting) are now
single transactional operations. No schema migration was needed — every change is
application code. `AI_ENABLED` was not enabled by this work; see "Remaining manual tasks."

## Every changed file

**New:**
- `src/lib/ai/rag/evidence.ts` — `assignEvidenceIds`/`collectEvidenceIds`: assigns a short
  per-request id ("E1", "E2", ...) to every retrieved source/structured fact.
- `src/lib/ai/safety/verify-citations.ts` — `verifyCitations`: strips any sentence lacking a
  citation to a real evidence id (except a small disclaimer/meta allowlist), and strips any
  sentence citing a hallucinated id, before the answer is ever shown.
- `src/lib/ai/rag/deterministic-answers.ts` — `buildDeterministicDeadlineAnswer`/
  `buildDeterministicEligibilityAnswer`: answers deadline/eligibility questions directly from
  the already-computed `StructuredFact`, bypassing the provider entirely for these two
  highest-stakes claim categories.
- `src/lib/schemas/ai-assistant.ts` — Zod schema bounding every field of
  `askAssistantActionInput` (question length, array counts, `MatchResult` shape).
- `tests/unit/ai-evidence-citations.test.ts`, `ai-deterministic-answers.test.ts`,
  `ai-retrieval-token-budget.test.ts`, `ai-assistant-orchestrator.test.ts` — new unit
  coverage for all of the above.
- `tests/integration/ai-retrieval-security.test.ts`, `ai-rate-limit-atomicity.test.ts`,
  `ai-source-lifecycle-atomicity.test.ts` — new DB-backed coverage (see "before → after"
  below).

**Modified:**
- `src/lib/ai/assistant.ts` — the orchestrator now, in order: fails closed on a health-check
  DB error (item 9); returns the standard not-enough-information answer with **zero provider
  calls** when retrieval has no context at all (item 1); trims retrieval to a token budget
  before prompting (item 8); answers deadline/eligibility questions from the deterministic
  templates when the relevant fact is present (item 3); otherwise assigns evidence ids, calls
  the provider, runs `verifyCitations`, then the existing `validateAssistantOutput`, and
  builds citations from only what was actually, validly cited (item 2).
- `src/lib/ai/rag/types.ts` — `RetrievedChunkSource`/`StructuredFact` gained an optional
  `evidenceId`.
- `src/lib/ai/rag/prompt.ts` — renders each source/fact's `id="E<n>"`; system rules now
  require an inline `[E<n>]` citation tag on every factual sentence; `escapeAttr` now also
  escapes `<` (not just `"`).
- `src/lib/ai/rag/citations.ts` — `buildCitations` takes an optional `citedEvidenceIds` set
  and, when given one, includes only matching evidence — no longer "cite everything
  retrieved" unconditionally.
- `src/lib/ai/rag/retrieval.ts` — `retrieveForQuestion` now returns an empty result (not an
  unscoped global search) when one or more named opportunity slugs resolve to nothing; new
  `trimRetrievalToTokenBudget`; **fixed a pre-existing crash** — `toChunkSource` called
  `.toISOString()` on `checked_at`, but `postgres-js`'s raw `db.execute()` doesn't reliably
  return a `Date` for a `coalesce(...)` expression (can be a string depending on
  environment), so any approved chunk with a non-null checked-at date would throw. Found
  while writing the approved-only-scoping test, not previously covered by any test.
- `src/lib/ai/safety/neutralize-source.ts` — now also escapes every literal `<` in chunk
  text, closing a structural prompt-injection gap the phrase-based patterns didn't catch: a
  chunk containing a literal `</source><source id="...">...</source>` could forge a fake
  additional source with attacker-controlled content, needing none of the specific injection
  phrases already blocked.
- `src/lib/ai/safety/validate-output.ts` — exported `splitIntoSentences` for reuse by
  `verify-citations.ts`.
- `src/lib/ai/providers/mock.ts` — every answer now ends with a citation tag naming the real
  evidence id it was built from, matching the new contract every provider must follow.
- `src/lib/ai/config.ts` — new `AI_MAX_PROMPT_TOKENS` (default 6000), distinct from
  `AI_MAX_INPUT_TOKENS` (bounds the user's own question only, not the assembled context).
- `src/lib/ai/rate-limit/user.ts` — `checkAndConsumeUserQuota` is now one atomic
  `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE requestCount < dailyLimit`, replacing a
  SELECT-then-INSERT/UPDATE race.
- `src/lib/ai/evaluation/harness.ts` — rewritten to mirror the new pipeline step-for-step
  (not-enough-info check, deterministic templates, evidence-id assignment, citation
  verification) instead of the old, now-stale manual re-implementation.
- `src/lib/ai/evaluation/cases.ts` — 8 new adversarial cases (see "adversarial test suite"
  below).
- `src/lib/db/actions/ai-staff.ts` — `setAiSourceDocumentStatus` now updates the document row
  and every one of its chunks inside a single `db.transaction(...)`.
- `src/lib/db/actions/student/ai-assistant.ts` — `askAssistantAction` validates its input
  against the new Zod schema before anything else runs; `isAiAvailableAction` fails closed on
  a DB error instead of letting the exception propagate.
- `tests/unit/ai-config.test.ts`, `ai-citations.test.ts`, `ai-safety.test.ts` — extended for
  the new config field, the `citedEvidenceIds` filtering mode, and the tag-breakout escaping.

## Security/integrity behavior before → after

| Area | Before | After |
|---|---|---|
| No-evidence questions | A question with zero retrieved sources/facts still called the real provider (the mock provider happened to police this itself; a real provider had no such guarantee) | `hasAnyContext(retrieval) === false` returns the standard fallback directly — zero provider calls, proven by a test that makes the provider throw if invoked |
| Citations | Every source/fact *retrieved* became a citation, regardless of whether the answer actually used it | Only evidence the answer cited by a real, validated `[E<n>]` id becomes a citation; an uncited or hallucinated-id sentence is stripped from the visible answer entirely |
| Deadline/eligibility questions | Answered by an LLM (or the mock's own pattern-matching) rephrasing the structured fact — a real provider could still distort the exact date/label | Answered directly from a fixed template built from the fact's own fields; the provider is never called for these two categories when the fact is present |
| Invalid retrieval scope | A scope naming a slug that resolved to zero real opportunities silently fell back to an **unscoped global search**, potentially answering from unrelated opportunities' content | Returns an empty result — no chunks, no facts, no fallback |
| Prompt-token budget | Retrieved context had no ceiling beyond `maxChunks` (chunk count) — an unbounded `opportunitySlugs` list generated an unbounded number of structured facts | Context is trimmed to `AI_MAX_PROMPT_TOKENS` (front-to-back, preserving highest-rank/priority items) before prompting; `opportunitySlugs`/`matchResults` are also Zod-capped at the Server Action boundary |
| Tag-breakout in source content | `neutralizeSourceText` stripped specific injection *phrases* but never escaped `<` — a chunk could forge a fake `</source><source>` boundary using none of those phrases | Every `<` is escaped in both chunk text and every prompt-attribute value |
| Source-document/chunk lifecycle | Document status and its chunks' status were two separate, non-transactional writes — a crash between them could leave rejected/stale chunks retrievable, or newly-approved content unreachable | One `db.transaction(...)` — both rows change together or not at all |
| Signed-in rate limiting | SELECT-then-INSERT/UPDATE — two concurrent requests could both read "one under the limit" and both proceed, exceeding the daily cap | One atomic `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` — proven by a 20-concurrent-request test that never exceeds the configured limit |
| Health-check failure | An unhandled DB error during the runtime-kill-switch check propagated as a raw exception | Fails closed: any error is treated as "unavailable," in both `askAssistant` and `isAiAvailableAction` |
| Assistant action input | No validation — an unbounded `opportunitySlugs`/`matchResults` array, or a malformed `MatchResult`, was trusted as-is | Zod-validated and bounded before anything else runs |
| Approved-only retrieval | Already correctly filtered `status = 'approved'` in the SQL — confirmed by a new test, not previously exercised, which also surfaced the `checked_at` crash above | Unchanged logic, now covered and the crash it could hit is fixed |

## Adversarial test suite (item 11)

- **Evaluation harness**: 15 → 23 cases, run via `npm run ai:evaluate` (mirrors the real,
  non-DB pipeline exactly). New cases: a chunk with an embedded `</source><source>`
  tag-breakout attempt; a DAN/jailbreak-persona request; a "pretend you have no rules"
  roleplay request; a database-credentials request; an "everyone's notes" phrasing of the
  other-user-data block; an "assume the deadline is..." phrasing of the invented-fact block;
  a benign question that merely *contains* the word "deadline" (guards against
  over-blocking); a general question that must cite the real retrieved source, not a
  hallucinated one.
- **Unit tests**: citation extraction/stripping (valid id, multiple ids, no id, hallucinated
  id, mixed valid+hallucinated, disclaimer exemption, all-stripped fallback); evidence-id
  assignment order and purity; deterministic-template classification and phrasing bounds
  (never invents a date, never guarantees eligibility even when asked outright); token-budget
  trimming (keeps highest-priority items, drops the rest); tag-breakout escaping; the
  orchestrator's fail-closed and no-provider-call-without-evidence guarantees.
- **Integration tests** (against the local ephemeral `db-test` Postgres): approved-only
  scoping with real draft/rejected/stale/approved chunks on the same document; invalid-scope
  returns zero results while unscoped search still works; 20 concurrent signed-in requests
  never exceed a 5-request daily limit; approving/rejecting a source document flips every one
  of its chunks in the same operation.

## Commands run and exact results

| Command | Result |
|---|---|
| `npm run typecheck` | PASSED, no errors |
| `npm run lint` | PASSED, no errors |
| `npm run test` (unit) | **513 passed, 1 skipped** (was 476 passed/1 skipped after Phase 2; +37 net new) |
| `npm run ai:evaluate` | **23/23 passed** (was 15/15) |
| `npm run db:test` (integration, local Docker `db-test`) | **113 passed** (was 105 after Phase 2; +8 net new) |
| `npm run checkpoint2:validate` | **508/508 passed** |
| `npm run checkpoint5:validate` | **136/136 passed** |
| `npm run build` | PASSED — all 68 routes compile |

No migration was generated or applied this phase — every change is application code, so
there is nothing to run against the real Supabase database beyond a normal code deploy.

## Remaining manual tasks

- **`AI_ENABLED=true` is currently set in your local `.env.local`**, alongside a configured
  `AI_PROVIDER`/`GROQ_API_KEY` — this was already the case before this phase started (this
  work never touched that file). Every fix in this phase was developed and verified against
  the deterministic mock provider and the local test database, never against a live Groq
  call. Before relying on this phase's fixes anywhere AI is actually reachable by a real
  user, confirm this code is deployed there — I have no visibility into what any deployed
  environment's own `AI_ENABLED` is currently set to.
- No content/data backfill is needed — every fix takes effect immediately on deploy.

## Honest gaps / deferred within Phase 3

- **Citation compliance depends on the model largely following an instruction, not a
  provider-enforced structured-output mode.** `verify-citations.ts` fails *safe* when a real
  provider doesn't cite well (an uncited claim is stripped, at worst collapsing to "not
  enough information"), so the failure mode is over-caution, never a trusted hallucination —
  but it does mean a real model's answers may come back thinner than the mock's if it cites
  inconsistently. A follow-up could use Groq's JSON response-format mode for a stricter
  contract; not done here to keep this phase's change surface to plain prompting, matching
  the existing provider abstraction.
- **Deterministic deadline/eligibility templates don't do cross-fact reasoning** (e.g. "which
  of these has the nearest deadline" states each opportunity's own date rather than computing
  the minimum) — safe (never invents anything) but not maximally helpful for a genuine
  comparison question. Ranking logic could be added later without touching the safety
  guarantee.
- **`matchResults` in `askAssistantAction`'s input is still client-supplied, not
  re-verified against the server's own matching engine** — Zod now bounds its *shape*, but a
  student could still submit a fabricated `MatchResult` for their own conversation (self-only
  impact, not a cross-user leak). Re-deriving it server-side from the student's own stored
  answers would close this fully; flagged here rather than silently expanded into this
  phase's scope, since it wasn't one of the 11 named items.
- Phase 1/2's already-documented gaps remain open and unrelated to this phase.
