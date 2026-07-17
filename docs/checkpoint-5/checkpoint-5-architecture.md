# Checkpoint 5 architecture

A source-grounded AI assistant, added alongside every prior checkpoint's guest mode, cloud sync,
deterministic matching, and staff review workflow — never replacing any of them. This document
explains the provider abstraction, the RAG (retrieval-augmented generation) pipeline, the
document→chunk source model, retrieval strategy, citation strategy, server/client boundaries, the
privacy model, rate limiting, the safety model, offline behaviour, and a note on future migration
paths. See [ai-safety-policy.md](ai-safety-policy.md) and
[rag-source-management.md](rag-source-management.md) for the two deepest-dive topics.

## Provider abstraction

`src/lib/ai/providers/` defines one interface (`AiProvider`, `types.ts`) with two implementations:

| | `MockAiProvider` | `GroqAiProvider` |
| --- | --- | --- |
| Network calls | None — pure pattern matching over the prompt | One `fetch` to Groq's OpenAI-compatible chat-completions endpoint |
| Requires a key | No | Yes (`GROQ_API_KEY`) |
| Used by | Every automated test, and any environment with `AI_PROVIDER=mock` | Real deployments with `AI_PROVIDER=groq` and a key configured |
| Determinism | Fully deterministic — same input, same output | Not deterministic (a real model) |

`getAiProvider()` (`providers/index.ts`) resolves the configured provider or returns `null` when AI
isn't actually usable — callers must treat `null` as "show the unavailable state," never throw.
Adding a third provider later means implementing `AiProvider` and adding one branch to
`getAiProvider()`; nothing else in the RAG/safety/UI layers is provider-specific.

## Configuration: isolated from the rest of the app on purpose

`src/lib/ai/config.ts`'s `getAiConfig()` is deliberately **not** part of `src/lib/env.ts`'s
`getServerEnv()`. `getServerEnv()` throws `EnvironmentConfigurationError` when Supabase/database
config is missing — exactly the right behaviour for those variables, since nothing in the app
works without a database. But if AI config lived there too, a missing or malformed `GROQ_API_KEY`
would take down every unrelated feature. Instead, `getAiConfig()` never throws: a missing or
malformed AI variable always resolves to a safe "AI unavailable" default. `estimateTokenCount()`
was later split out into its own `src/lib/ai/token-estimate.ts` (no `server-only` guard) because
`src/lib/ai/rag/chunking.ts` needs it and chunking must also run from a plain CLI script
(`scripts/ai-sources-reindex.ts`), where `import "server-only"` would otherwise throw outside
Next.js's `react-server` build condition.

Two independent "off" switches exist, and they mean different things:

- **`AI_ENABLED=false`** (env var, default) — a deployment-time default. Changing it requires a
  redeploy/restart, matching the existing `ENABLE_DATABASE_CATALOGUE`/`ENABLE_STAFF_ADMIN` pattern.
- **`ai_provider_health.manually_disabled`** (DB-backed, staff-controlled) — an Administrator can
  flip this instantly from `/staff/ai` to pause the assistant mid-incident, with no redeploy.
  `askAssistant()` and the page-level `isAiAvailableAction()` pre-check both consult this in
  addition to the env flag.

## The RAG pipeline

```
question ──▶ classifyUserIntent() ──(blocked)──▶ refusal, no retrieval, no provider call
             │
             (not blocked)
             ▼
        retrieveForQuestion() ──▶ { sources[], structuredFacts[] }
             │
             ▼
        buildPromptMessages() ──▶ [system: rules, system: context, user: question]
             │
             ▼
        provider.generate() ──▶ raw text
             │
             ▼
        validateAssistantOutput() ──▶ final text (claims stripped, secrets redacted)
             │
             ▼
        buildCitations(retrieval) ──▶ citation records
```

All of this is orchestrated by `askAssistant()` in `src/lib/ai/assistant.ts`, the single entry
point every route/action calls. It never persists a conversation itself — the caller
(`src/lib/db/actions/student/ai-assistant.ts`) decides whether to save history, based on the
requester (guest vs. signed-in) and their history setting.

### Two kinds of retrievable material, never a third

Per the checkpoint brief, the assistant may only ever answer from:

1. **Approved source chunks** (`ai_source_chunks`, `status = 'approved'`) — staff-authored,
   plain-text excerpts of official-source content, found via PostgreSQL's built-in full-text
   search. See [rag-source-management.md](rag-source-management.md).
2. **Structured facts** — deterministically computed from the same published data the public
   catalogue already exposes (deadline evaluation, eligibility rule text, funding categories,
   document counts, and — only for the matching-explanation surface — a deterministic
   `MatchResult`). Built by `src/lib/ai/rag/structured-facts.ts` from
   `src/lib/catalogue/db-repository.ts`'s `getPublishedOpportunities()`, the exact same repository
   the public catalogue itself uses. A stale or missing fact shows up as "unknown"/"unverified"
   here exactly as it would on the opportunity's own page — the assistant can never know more than
   the published record does.

Draft/rejected/stale chunks, unpublished opportunities, staff notes, review comments, and other
students' private data are never queried by the retrieval layer at all — not filtered out after
the fact, simply never selected in the first place (`src/lib/ai/rag/retrieval.ts`).

### Why full-text search, not embeddings/pgvector

The Checkpoint 5 brief's required env var list includes `GROQ_API_KEY` (a chat-completion key)
but no embeddings-provider key. Building the retrieval layer's primary mechanism around pgvector
similarity search would mean shipping a structurally-present-but-never-actually-populated feature.
Instead, `ai_source_chunks.chunk_text` gets a generated `tsvector` column
(`chunk_text_search`) and a GIN index (`drizzle/0008_ai_grants_and_search.sql`), and
`retrieveForQuestion()` queries it with `websearch_to_tsquery()` — no extension required, works on
any Postgres. A `pgvector` extension + `embedding vector(1536)` column is *also* added, in the same
migration, inside the same exception-guarded `DO $$ ... EXCEPTION WHEN insufficient_privilege OR
undefined_file OR feature_not_supported ...` pattern Checkpoint 4 used for `pg_trgm` — mirroring
that precedent exactly. This is an honest structural allowance for a future embeddings provider,
not a working feature today: nothing populates the `embedding` column, and retrieval never queries
it. If the full-text query ever throws for any reason, `retrieveForQuestion()` falls back to a
plain `ILIKE` scan, matching the same "never let a missing capability break the feature" ethos as
Checkpoint 4's `pg_trgm` fallback.

### Document → chunk model

Staff edit and approve `ai_source_documents` at the whole-document level (title, source text,
optional links to an opportunity/official source/required document/eligibility rule). The system
auto-derives `ai_source_chunks` from the document's text via `src/lib/ai/rag/chunking.ts`'s
`chunkText()` — a pure, deterministic splitter (prefers paragraph boundaries, falls back to
sentence boundaries, hard-splits only as a last resort) — and denormalizes `opportunityId`,
`officialSourceId`, and `status` onto each chunk so retrieval never needs a join back to the parent
document. "Rebuild chunks" (staff UI button, `npm run ai:sources:reindex` CLI) re-derives chunks
from the document's *current* text and re-syncs status. Editing a previously-approved document's
text resets it to `draft` — an edited excerpt must be re-approved, never silently stays trusted.

### Citations: cite everything retrieved, not sentence-level attribution

`buildCitations()` (`src/lib/ai/rag/citations.ts`) turns every source/structured-fact actually
placed in the prompt into a citation candidate — a deliberate simplification over fine-grained
sentence-to-source attribution. It is simpler, fully deterministic, and never *under*-cites a claim
the provider could have drawn from that context. The UI (`AssistantChat.tsx`'s `CitationList`)
distinguishes four citation types (`ai_citation_source_type`): `official-source` (a chunk linked to
a real official source), `structured-data` (ScholarTrack's own deadline/eligibility/funding/
document records), `workspace-context` (reserved for the student's own tracked data — not
currently populated by any UI, since the workspace assistant deliberately never sends private
notes/checklist text to the model), and `match-explanation` (the deterministic matching engine's
own output).

## Server/client boundaries

Every provider call, every retrieval query, and every safety check happens server-side
(`import "server-only"` on `config.ts`, `assistant.ts`, `retrieval.ts`, the provider classes).
`askAssistantAction()` (`src/lib/db/actions/student/ai-assistant.ts`, a Next.js Server Action) is
the only way a client component reaches any of it. No AI-related route is a GET API endpoint;
everything is a POST Server Action, so the service worker's GET-only `fetch` listener never
intercepts or caches AI request/response content at all.

## Privacy model

| | Guest | Signed-in student |
| --- | --- | --- |
| Default | Conversations stored locally (IndexedDB `aiConversations`/`aiMessages` stores, schema v5) | **Not stored** unless the student explicitly enables history in `/assistant/settings` |
| Temporary chat | Nothing stored anywhere, even locally | Nothing stored server-side for that turn |
| Export | Only if the guest checks "include assistant conversation history" on the Settings backup screen | Only if history is enabled — folded into the existing account JSON export |
| Delete | "Clear local AI history" button, or "clear all local data" | "Clear cloud AI history" button, or account deletion (cascades via FK) |
| Cross-user visibility | N/A (device-local) | Never — RLS restricts every AI table to its owner (see below) |

Feedback (`ai_feedback`) is the one AI table staff can read regardless of ownership — it is
explicitly submitted *for* staff review, matching the existing `correction_reports` precedent, not
the private-workspace-data precedent. A student must have history enabled for feedback to exist at
all: `ai_feedback.message_id` requires a real, owned `ai_messages` row, and the assistant UI only
shows the feedback control on a message that came back with an `assistantMessageId` (i.e. was
actually persisted). Guests and history-disabled students can still use the assistant fully; they
simply have no server-side message to attach feedback to.

## Rate limiting

Guests are limited via a signed (HMAC), httpOnly cookie holding `{date, count}`
(`src/lib/ai/rate-limit/guest.ts`) — never a growing table of anonymous device identifiers, and
never IP-based. The signature only needs to stop a guest from hand-editing the cookie to reset
their own count; it is an abuse deterrent, not an authentication boundary, so a safe local fallback
secret is used when `SUPABASE_SECRET_KEY` isn't configured rather than throwing. Signed-in
students get a durable DB counter (`ai_usage_limits`, `src/lib/ai/rate-limit/user.ts`), which the
student may read but never write directly — the table's RLS policy is a hand-written read-only
`pgPolicy`, not the shared `ownerAllPolicy` helper, because an owner-writable counter would let a
student trivially reset their own quota.

## Safety model

See [ai-safety-policy.md](ai-safety-policy.md) for the full policy. In short: a deterministic,
regex-based pre-flight classifier blocks hidden-prompt/secret/other-user-data/injection/
invented-fact requests *before* any retrieval or provider call; untrusted retrieved chunk text is
neutralized for embedded instructions before it reaches the prompt; and a post-generation output
validator strips prohibited claims (eligibility/admission guarantees, invented certainty) and
redacts secret-shaped strings, regardless of which provider produced the text. None of these three
layers trusts the mock or a real LLM's own judgment.

## Offline behaviour

`/assistant`, `/assistant/history`, `/assistant/settings`, and `/workspace/assistant` render a
signed-in student's own data and are added to `middleware.ts`'s `SESSION_AWARE_PUBLIC_PREFIXES`,
getting the same `Cache-Control: no-store` treatment for a signed-in visit (and `no-cache` for a
guest) as `/workspace`/`/compare`/etc. already do. They are deliberately **not** added to
`public/sw.js`'s `APP_SHELL_URLS` precache list, for the same reason those Checkpoint 4 pages
aren't: precaching a personalised page would bake one visitor's rendered HTML into the shared
cache. Going offline and revisiting the assistant falls back to the standard `/offline` page,
honestly showing the feature is unavailable, while the rest of the app (catalogue, workspace)
keeps working from its own, separately-cached data. `/staff/ai/**` is already covered by the
service worker's blanket `/staff` exclusion.

## Known limitations / future migration paths

- **pgvector is structural, not functional.** No embeddings provider is configured or called;
  full-text search is the only retrieval mechanism that actually runs today.
- **Citations are retrieval-level, not sentence-level.** Every retrieved item becomes a citation
  candidate rather than being matched to the specific sentence it supports.
- **Guest feedback isn't sent to staff.** Feedback requires a persisted (signed-in,
  history-enabled) message; a guest can still use the assistant fully, just without a
  staff-visible feedback channel unless they sign in and enable history.
- **Cloud import doesn't restore AI history.** Export includes AI history when enabled; importing
  a previous account export restores every other section but not AI conversations, to keep the
  import path's scope contained. History moving forward is unaffected.
