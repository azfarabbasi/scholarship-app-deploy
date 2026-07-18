# Checkpoint 7: Content readiness report

Numbers below are real, queried directly from a database that has run the exact same
`db:migrate` → `db:seed:taxonomies` → `db:import:legacy` sequence a real launch would use (see
`docs/checkpoint-7/database-launch-runbook.md`). They are not estimated, and nothing was
published or marked verified to make this report look better. Reproduce them yourself with
`npm run launch:content` (`scripts/launch-content-report.ts`).

## Headline numbers (queried against a freshly migrated + imported local database)

| Metric | Count | Notes |
|---|---|---|
| Total opportunities imported | 55 | The v0.1 legacy migration seed — see `docs/checkpoint-0/dataset-inventory.md`. |
| Published (publicly visible) | **0** | Importing never auto-publishes anything — this is by design (`docs/checkpoint-2/migration-runbook.md`, "Publication is a separate, human decision"). |
| In review | 1 | One record has been moved to `in_review` in this development database (from earlier manual workflow testing) — not a completed review. |
| Draft (not yet submitted) | 54 | |
| Rejected/archived | 0 | |
| With at least one official source linked | 55 / 55 (100%) | Every legacy record carries its original source URL, in `candidate` status — a human has not yet upgraded any to `confirmed-official`. |
| With `overall_verification_status = verified` | 0 / 55 (0%) | All 55 are honestly `unverified` — the importer never marks anything verified (see the migration runbook's "What the importer actually does, precisely"). |
| With structured eligibility rule data | 55 / 55 (100%) | Preserved from the legacy dataset, in `draft` status pending reviewer promotion. |
| With required-document data | 0 / 55 (0%) | The legacy v0.1 dataset did not include structured required-document lists — this is a genuine content gap, not a bug. |
| Deadline precision: exact | 24 / 55 | |
| Deadline precision: estimated | 20 / 55 | |
| Deadline precision: rolling | 5 / 55 | |
| Deadline precision: unknown | 6 / 55 | |
| Stale / needing re-review | Not applicable yet | Nothing has been published, so nothing can be "stale" (staleness is measured from `last_checked_at` on published records — see `docs/checkpoint-6/backup-and-recovery.md` §12). |

## The 100-record target

**Not met.** 55 real, sourced records exist; 0 are published. Even in the best case (all 55
reviewed and published), that is 55/100 — **45 additional real, sourced records are still
needed**, exactly as reported in `docs/checkpoint-2/content-expansion-gap.md` at the end of
Checkpoint 2, and unchanged since (no new records have been added in Checkpoints 3–6, which were
engineering-focused, not content-focused).

**This launch is classified as "content target incomplete."** Per this checkpoint's own rule
("never claim the 100-record target passed unless it actually passed"), that classification is
non-negotiable given these numbers.

## Why 0 are published, and what has to happen before real launch

Nothing here is broken. Every one of these 55 records must go through the same human review
pipeline as any newly-imported record, exactly as designed:

1. A Reviewer or Senior Reviewer opens the record at `/staff/opportunities/[id]` and checks it
   against `docs/checkpoint-2/data-verification-procedure.md`'s reviewer checklist.
2. They submit it for review (if not already) and a *different* person reviews it
   (`canReview()` — never the same person who drafted/edited it, short of an audited
   Administrator override).
3. A Senior Reviewer or Administrator approves it.
4. The official source is upgraded from `candidate` to `confirmed-official` with a real,
   actually-checked `last_checked_at` date — never a fabricated one.
5. The funding benefit and eligibility rule rows are promoted to `published`/`active`.
6. The record is published.

`npm run db:publish:test-fixtures` exists and can push all 55 through this pipeline
instantaneously — **but it is explicitly a test-only shortcut** (see
`docs/checkpoint-2/migration-runbook.md`, "Test-only fixture publishing... never use this for
real content") that skips genuine human review. It is used by the Playwright e2e suite so it can
exercise a realistic catalogue, and nowhere else. Running it against a database serving real
users would mean claiming 55 records are "reviewed" when no human ever reviewed them — exactly
the kind of fabrication this checkpoint's rules forbid. It was **not** run against the database
these numbers were queried from.

## Recommendation

- **Launch as a limited beta with 0–55 published records** (once staff complete real review of
  some or all of the 55 legacy records), being transparent in-product that the catalogue is
  still growing — OR
- **Delay public launch** until either more records are reviewed, or the product messaging is
  adjusted to set correct expectations for a smaller initial catalogue.

Either way, **do not present this launch as having met the 100-record target** — see
`docs/checkpoint-7/launch-blocker-checklist.md` for how this is reflected in the go/no-go
decision.
