# RAG source management

How staff add, approve, and maintain the source material the assistant is allowed to retrieve
from. See [checkpoint-5-architecture.md](checkpoint-5-architecture.md) for how retrieval consumes
this material and [ai-safety-policy.md](ai-safety-policy.md) for the approval boundary's role in
the safety model.

## The two tables

- **`ai_source_documents`** — what staff actually edit. A title, plain-text `source_text` (never a
  file), an approval `status` (`draft` / `approved` / `rejected` / `stale`), and optional links to
  an opportunity, an official source, a required-document requirement, or an eligibility rule so
  staff can trace an excerpt back to the fact it supports.
- **`ai_source_chunks`** — what retrieval actually queries. Auto-derived from a document's text via
  deterministic splitting (`src/lib/ai/rag/chunking.ts`); never edited directly. Each chunk
  denormalizes `opportunity_id`, `official_source_id`, and `status` from its parent document.

## Adding an excerpt

1. Go to `/staff/ai/sources` (requires Reviewer, Senior Reviewer, or Administrator).
2. Fill in a title, optionally link a published opportunity, and paste the excerpt's plain text —
   copied from the official source, never an uploaded file (ScholarTrack does not accept document
   uploads anywhere, for any role).
3. Click "Create draft." The document is created with `status = 'draft'` — not yet retrievable by
   anyone, staff included, outside this management page.

## Approval lifecycle

```
draft ──approve──▶ approved ──(edit text)──▶ draft   (re-approval required)
  │                    │
  ├──reject──▶ rejected │
  │                    └──mark stale──▶ stale
  └──mark stale──▶ stale
```

- **Draft**: visible only to staff (`canManageAiSources`). Never retrievable by the public
  assistant.
- **Approved** (`canApproveAiSources` — Senior Reviewer/Administrator only): the only status the
  public retrieval query selects, and only when additionally linked to `opportunity_id IS NULL` or
  a currently-published opportunity.
- **Rejected**: permanently excluded from retrieval; kept for audit history rather than deleted.
- **Stale**: was approved, now flagged as needing review (optionally with a reason) — excluded
  from retrieval until re-approved.
- **Editing text always resets status to `draft`.** An edited excerpt is, by definition,
  unreviewed content — it must never silently keep an old approval (ADR-010: "being linked or
  chunked never implies approval").

Being linked to an opportunity/document requirement/eligibility rule is purely informational —
tracing an excerpt to what it supports. It has no effect on retrieval eligibility; only `status`
does.

## Rebuilding chunks

"Rebuild chunks" (per-document button, or "rebuild all") deletes the document's existing chunks
and re-derives fresh ones from its *current* `source_text`, carrying over the parent's current
`status`. Use this any time a document's text changes outside the normal edit flow, or as routine
maintenance. The same operation is available from the command line:

```bash
npm run ai:sources:reindex
```

This is an unauthenticated, operator-trusted CLI script (like `db-seed-taxonomies.ts`) — run it
directly against a database connection, not through the staff UI's permission checks. It rebuilds
every document's chunks in one pass.

## Retrieval coverage

`/staff/ai` (dashboard) and `/staff/ai/sources` show:

- How many published opportunities have at least one approved chunk with retrievable content.
- Document counts by status (draft/approved/rejected/stale) — a large stale/draft count is a
  signal that content needs review.
- Which specific published opportunities have **zero** approved source coverage — these
  opportunities still work with the assistant via structured facts (deadline, eligibility,
  funding, document-count), but have no staff-curated excerpt to draw from for open-ended
  questions.

## What counts as usable source material

Only what a public, signed-out visitor is already allowed to see through the ordinary catalogue —
concretely: a document/chunk pair with `status = 'approved'`, and either no linked opportunity
(general platform content) or a linked opportunity whose own `status = 'published'`. A source
"going approved" is never itself proof that the underlying fact is verified — that is a separate,
existing concept (`official_sources`/`verification_records`/`source_evidence` status, unchanged
from Checkpoint 2). An approved AI excerpt says only "staff have reviewed this text and judged it
safe and accurate to show the assistant" — the citation UI separately surfaces the linked
official source's own verification status and checked-at date, so a user can judge both signals.

## Limitations

- No file upload, ever — text only, pasted by staff. Scanning/copying an official page's content
  is a manual step; there is no automated scraper.
- Chunking is a fixed, deterministic algorithm (paragraph-first, ~700–1100 characters) — not
  configurable per document today.
- The full-text search query (`websearch_to_tsquery`) is English-tuned; multilingual excerpts are
  stored and displayed fine, but full-text ranking quality for non-English text is not tuned.
