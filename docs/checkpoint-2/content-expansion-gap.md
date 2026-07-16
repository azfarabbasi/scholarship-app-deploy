# Content expansion gap: the 100-record target

## Honest status

**The 100-record content target was not met in this checkpoint.** The catalogue currently
contains **55 real, sourced records** — the original v0.1 migration seed, imported and
traceable via `legacy_migration_reference`. **45 additional records are needed to reach 100.**
Zero fictional, placeholder, or unofficially-sourced records were added to make up the
difference, and none will be — see the rules below.

## Why no additional records were added this checkpoint

Adding 45 real opportunities responsibly requires, for each one: locating an official
government/university/foundation/employer/programme source, extracting the actual current
benefit/eligibility/deadline wording from that source, recording a genuine checked date, and
then routing the record through this checkpoint's own review workflow (never marking it
verified merely because someone entered it) — the same standard this checkpoint holds the
original 55 to. That is a real content-research and editorial-review workload, not a
software-engineering one, and doing it hastily is exactly how a "verified" catalogue ends up
with unverifiable or subtly wrong facts. This checkpoint's engineering scope (schema, RLS,
staff admin system, workflow, migration tooling, tests, docs) was itself substantial; rather
than rush 45 records through without genuine, individually-checked sourcing, this is reported
as an honest gap with the tooling now in place to close it deliberately.

## Rules that apply to closing this gap (do not skip these)

- Never generate fictional records.
- Never create placeholder opportunities and count them as reviewed.
- Never treat an unofficial aggregator page as sufficient official verification.
- Never publish a record without an official source.
- Never fabricate a verification timestamp — `last_checked_at` must be the date a human
  actually viewed the source.

## How to add the remaining 45 (recommended path)

1. Identify candidate opportunities from official sources only (government scholarship
   portals, university international-office pages, foundation grant pages, employer/programme
   sites).
2. For each: capture the official URL, the exact current wording for benefits/eligibility/
   deadline, and today's date as your checked date.
3. Use the CSV import path to bring them in efficiently as **drafts**:
   - Download the template: `GET /api/staff/csv-template` (administrator session required), or
     call `buildOpportunityCsvTemplate()` directly (`src/lib/csv/opportunity-import.ts`).
   - Fill one row per opportunity — see the template's header row and worked example for the
     exact expected columns (`title`, `summary`, `opportunityTypeCode`, `organisationName`,
     `providerName`, `countries`, `studyLevels`, deadline fields, source fields, etc.).
   - At `/staff/imports`, **dry run** the file first (`npm run db:import:legacy:dry-run`'s CSV
     sibling: the "Dry run" button on that page) and fix every reported row error before
     committing.
   - Commit the import — every row lands as an unpublished `draft`, exactly like the legacy
     migration.
4. Route each imported draft through the normal review workflow
   (`staff-roles-and-workflows.md`): submit for review, independent review, approval by a
   Senior Reviewer/Administrator who is not its author, upgrade its official source to
   `confirmed-official` with a real checked date, and only then publish.
5. Use the reviewer checklist in `data-verification-procedure.md` for every record before
   approving it, imported-via-CSV or not.

## Tracking progress toward 100

Run `npm run db:verify:migration` (reports the 55 legacy-imported records specifically) and
check `/staff` (dashboard counts: drafts, published, pending review) for the live total across
both the legacy import and any CSV-imported records. Do not report the 100-record criterion as
passed until `SELECT count(*) FROM opportunities WHERE status = 'published'` is genuinely ≥ 100
**and** every one of those has a real official source and an honest, non-fabricated
verification history.
