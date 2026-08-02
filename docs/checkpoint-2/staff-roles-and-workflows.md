# Staff roles and workflows

Authority: `docs/checkpoint-0/roles-and-permissions.md`. This document maps that policy onto
what Checkpoint 2 actually implements in `src/lib/auth/permissions.ts`,
`src/lib/workflow/opportunity-workflow.ts`, and the Server Actions under `src/lib/db/actions/`.

## Roles

Checkpoint 2 implements four **staff** roles (Guest and Student are out of scope for this
checkpoint — no student accounts exist yet):

| Role | `staff_role` enum value |
| --- | --- |
| Reviewer | `reviewer` |
| Senior Reviewer | `senior_reviewer` |
| Administrator | `administrator` |
| System Service | `system_service` (never a human login; used only by the legacy-migration script to attribute ingested evidence — see `migration-runbook.md`) |

## Permission matrix (as implemented)

Every row below is a function in `src/lib/auth/permissions.ts`, unit-tested in
`tests/unit/permissions.test.ts`. "Own/Assigned" columns are checked by the caller (the
Server Action knows which record is being acted on; the permission function only encodes the
role-level rule).

| Capability | Reviewer | Senior Reviewer | Administrator |
| --- | --- | --- | --- |
| Create opportunity draft | ✅ | ✅ | ✅ |
| Edit draft (own/assigned only) | ✅ | ✅ | ✅ |
| Submit for review | ✅ (own/assigned) | ✅ | ✅ |
| Review / request changes (never own draft) | ✅ | ✅ | ✅ |
| Approve (never own draft) | ❌ | ✅ | Override only, with a reason (audited) |
| Publish | ❌ | ✅ | ✅ |
| Archive / restore | ❌ | ✅ | ✅ |
| Assign reviewers | ❌ | ✅ | ✅ |
| Manage taxonomies / organisations | ❌ | ✅ | ✅ |
| Manage documents / eligibility rules (per-opportunity) | ✅ | ✅ | ✅ |
| Triage correction reports | ✅ | ✅ | ✅ |
| Manage duplicate candidates (merge) | ❌ | ✅ | ✅ |
| Run CSV/legacy imports | ❌ | ❌ | ✅ |
| Manage staff (invite/revoke roles) | ❌ | ❌ | ✅ |
| View full audit log | ❌ | ❌ | ✅ (Reviewer/Senior Reviewer see their own assignments and review-scoped history in context, not the global log — a documented simplification from Checkpoint 0's fuller matrix) |

This is enforced **server-side** in every Server Action — `src/components/staff/StaffNav.tsx`
filters the visible nav by the same functions purely for UX; hiding a link is never the
security boundary (verified: every action independently calls `getStaffSession()` +
the relevant `can*()` check before touching the database).

## Opportunity state machine

```
 draft ──submit-for-review──> in_review ──mark-reviewed──> reviewed ──approve──> approved ──publish──> published ──archive──> archived
   │                              │                            │                    │                                            │
   │                    request-changes                request-changes            schedule                                   restore
   │                              │                            │                    │                                            │
   │                              ▼                            ▼                    ▼                                            ▼
   │                     changes_requested <──resubmit── (back to in_review)   scheduled ──publish──> published            (back to approved)
   │
   └──reject (from draft/in_review/reviewed/changes_requested)──> rejected  [terminal]

(any of draft/in_review/reviewed/approved/scheduled/published) ──mark-merged──> merged  [terminal, via the Duplicates workflow only]
```

Full transition table: `src/lib/workflow/opportunity-workflow.ts` (`TRANSITION_RULES`), unit
tested exhaustively in `tests/unit/opportunity-workflow.test.ts` (every status's
`availableTransitions()` is asserted to only contain transitions `isValidTransition` also
allows).

Notes:
- `rejected`, `superseded`, and `merged` are terminal — no transition leaves them.
- `restore` returns an archived record to `approved`, **not** `published` — restoring publicly
  requires a fresh, explicit `publish` action, so a restored record never silently reappears
  without a human decision at that moment.
- Publishing is blocked at the database level (not just the workflow function) if there is no
  linked official source, regardless of which code path attempts it.

## Separation of duties

- `canReview(roles, staffId, authorId)` returns `false` when `staffId === authorId` — a
  reviewer can never review their own draft, checked against the opportunity's
  `created_by_staff_profile_id`.
- `canApprove(roles, staffId, authorId)` requires the `senior_reviewer` role **and**
  `staffId !== authorId` — a Senior Reviewer can never approve their own draft.
- `isAdministratorOverride(roles, reason)` is the only path for an Administrator to approve a
  record they could not otherwise approve (their own draft, or one lacking independent
  review) — and it requires a non-empty, non-whitespace reason string. Every override is
  recorded via `recordAuditEvent()` with `redactedChangeSummary` explicitly stating "Administrator
  override" and the reason, action `"approve"`.

### Bootstrap administrator testing exception

Local/testing environments may set `ALLOW_ADMIN_SELF_REVIEW=true` to let the single verified
account matching `BOOTSTRAP_ADMIN_EMAIL` exercise a complete workflow. The account must still
have an active profile and active `administrator` assignment. Its self-assignment, review,
approval, source/evidence confirmation, verification confirmation, and child-record promotions
are explicitly labelled in the audit log. Database self-approval checks accept the exception
only for that actor UUID inside the current transaction. Other administrators retain the matrix
above, and production startup rejects the flag.

This exception never bypasses publication prerequisites, state transitions, audit immutability,
cross-opportunity relationship checks, or student-data ownership.

## Reviewer assignment

`/staff/assignments` (senior_reviewer/administrator only) lists every `in_review` opportunity
with no active `review_assignments` row, and lets the caller assign a reviewer — with the
opportunity's own author excluded from the reviewer dropdown at the query level
(`src/lib/db/actions/reviews.ts::assignReviewer`), and rejected server-side again if bypassed.
Reviewers see their queue at `/staff/reviews` and can `Accept` an assignment (moves
`queued`/`assigned` → `accepted`).

## Archive and restore

Both require `senior_reviewer` or `administrator`. Archiving sets `archived_at` and is blocked
by a CHECK constraint if attempted without it (belt-and-suspenders alongside the workflow
function). An archived record is immediately excluded from every public query (RLS's public
`SELECT` policy filters on `status = 'published'`, and `archived` is a distinct status).

## Duplicate merge process

1. `runDuplicateDetection()` (administrator/senior_reviewer) scans all non-merged/-archived/
   -rejected opportunities pairwise using `src/lib/duplicates/detect.ts`'s signals (identical
   legacy migration reference, identical normalised official URL, same provider + normalised
   title, or a token-similarity fuzzy match above threshold) and inserts `duplicate_candidates`
   rows — **never** merges automatically.
2. A human reviews each candidate at `/staff/duplicates` and either:
   - **Dismisses** it as a false positive (`dismissDuplicateCandidate`, requires a reason), or
   - **Merges** it (`mergeDuplicates`, requires a reason): the duplicate's `status` becomes
     `merged` with `merged_into_opportunity_id` set (it can never be independently published
     again — the workflow has no transition out of `merged`), its old slug gets a redirect row
     in `opportunity_slug_redirects`, and both the candidate and the merge itself produce an
     audit event (`action: "merge"`).
3. The merge is reversible in the sense that nothing is deleted — the duplicate opportunity's
   full row and version history remain in the database; only its `status` and the new redirect
   row are added. Un-merging (if ever needed) is a manual data correction, not a one-click undo,
   which is an intentional bias toward requiring a deliberate action for something this
   consequential.
