# Data verification procedure

For reviewers and senior reviewers deciding whether an opportunity fact is ready to publish.
This operationalises `docs/checkpoint-0/roles-and-permissions.md` and
`docs/checkpoint-0/deadline-intelligence-spec.md` into a concrete checklist against this
checkpoint's actual staff UI.

## What counts as an official source

An `official_sources` row may only reach `confirmed-official` (or later) status when:
- The URL is controlled by the provider or organisation itself (its own domain, an official
  government/university/foundation page, or an official application portal) — **not** a
  third-party scholarship-aggregator site, forum, or news article restating the offer.
- A responsible `publisher_organisation_id` or `publisher_provider_id` is set (the database
  CHECK constraint `official_sources_confirmed_requires_publisher` enforces this).
- You have actually opened the page yourself during this review — do not confirm a source based
  on someone else's summary of it.

## How to record the checked date

Set `last_checked_at` to the real date/time you personally viewed the source content — never a
fabricated or rolled-forward date, and never today's date if you're relying on a check someone
else did earlier (create a new verification pass instead, or note the original checker's date
explicitly if the workflow is later extended to record that separately).

## How to assess deadlines

Follow `docs/checkpoint-0/deadline-intelligence-spec.md` for the full state machine. In this
checkpoint's UI terms:
- Only set `precision = 'exact'` when the official source states a specific calendar date for
  the cycle you're recording. Fill `opening_date`/`closing_date` accordingly.
- Use `'estimated'` when the source implies a date range or "typically opens in X" without
  committing to an exact day — the database still requires *a* date for `estimated`, but the UI
  and public labelling must make clear it is not exact.
- Use `'rolling'` or `'unknown'` when there is genuinely no fixed date — the database's CHECK
  constraint physically prevents you from attaching a date to these precisions, so there is no
  way to accidentally fabricate one.
- **Never** roll a passed date forward into a new year/cycle. If the next cycle's date isn't
  published yet, create a new `deadline_cycles` row once it is announced — don't edit the old
  one.
- Record `verification_status` per occurrence honestly: `unverified` until you've personally
  confirmed it, `stale` once significant time has passed since `last_checked_at` without
  re-confirmation (no fixed staleness window is enforced by the software yet — use judgement
  and the opportunity's own cycle cadence).

## How to assess required documents

- Only attach an `opportunity_document_requirements` row when the official source explicitly
  states the requirement — link the `source_evidence_id` you captured for it.
- Use `requirement_level = 'required'` only for unconditional requirements; use
  `'conditionally-required'` when the source states a condition (e.g. "required for non-native
  English speakers") and record the condition in `condition_summary`.
- Never let a generic document *template* (`required_document_templates` — "CV", "personal
  statement", etc.) imply an opportunity-specific requirement on its own. Only a row in
  `opportunity_document_requirements` with `status = 'published'` may appear under "Official
  required documents" on the public page; a guest's own local checklist is rendered separately
  and labelled "Your preparation checklist".

## How to assess eligibility

- Every `eligibility_rules` row requires a `source_evidence_id` — never record a rule from
  memory or inference.
- Prefer the most specific `kind` available (`nationality`, `study-level`, `academic-score`,
  etc.) over `'other'` so the rule remains machine-readable for a future evaluation engine
  (explicitly out of scope for this checkpoint, but the data should still be structured well
  now).
- When the source is ambiguous or silent on a criterion, do not invent a rule to fill the gap —
  leave it unrecorded. Unknown is a valid, honest state; a fabricated "no restriction" rule is
  not.

## Stale-source handling

If a source you previously confirmed no longer loads, or its content has visibly changed
without a corresponding update to the opportunity's facts:
1. Do not leave the opportunity published with outdated confirmed facts.
2. Update the `official_sources` row's status (`changed`/`unavailable`) and re-verify the
   dependent facts against the new content, or archive the opportunity if the programme appears
   discontinued (via a Correction Report if a guest flagged it first, or directly if you found
   it yourself).
3. Record the change with a reason via the normal edit/version flow so the history shows why.

## Rejection rules

Reject (send back with `request-changes`, or `reject` outright if unsalvageable) a draft when:
- It has no official source at all, or only a third-party aggregator link.
- A deadline is recorded with more precision than the source actually supports (e.g. an exact
  date invented from a vague statement).
- Required-document or eligibility claims are recorded without a linked `source_evidence_id`.
- The benefit/eligibility wording appears copied from an unrelated or outdated programme page.

## Reviewer checklist (per opportunity, before approving)

- [ ] At least one official source, from the provider/organisation itself, confirmed-official.
- [ ] `last_checked_at` reflects a check *you* performed, dated honestly.
- [ ] Deadline precision matches what the source actually supports; no rolled-forward or
      invented dates.
- [ ] Every funding-benefit line is promoted to `published` only if it reflects the current
      source wording.
- [ ] Every required-document row cites its own source evidence.
- [ ] Every eligibility rule cites its own source evidence and uses the most specific `kind`
      available.
- [ ] You are not the author of this draft (or, if you are and no independent reviewer exists,
      you are not the one approving it — see `staff-roles-and-workflows.md` on separation of
      duties).
- [ ] The change includes a clear reason if this is a revision to a previously published
      record.
