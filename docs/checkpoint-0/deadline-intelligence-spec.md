# Checkpoint 0: Deadline intelligence specification

## Status, scope, and normative language

This document is the normative deadline policy for ScholarTrack. It specifies
future domain behaviour; it does not approve any current seed fact for
publication and does not define a user interface. It was prepared without
internet research. The legacy prototype is behavioural evidence only, not an
authoritative deadline source.

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative. A
conforming implementation MUST use the canonical machine values shown in
backticks. Display copy may be translated later, but the English
student-facing labels defined here are the only canonical English label values.

The core safety rule is: **a date-looking value is not necessarily an actionable
deadline**. Precision, cycle, scope, source, verification, and timezone must all
be resolved before a countdown or application prompt is allowed.

## Domain boundaries and invariants

Deadline intelligence separates five concepts that the prototype currently
compresses into one date array:

1. An **opportunity** is the enduring scheme or programme.
2. A **deadline cycle** identifies one published application cycle and its
   target intake. A year alone is not a sufficient cycle identity.
3. A **deadline occurrence** is one scope-aware application event within a
   cycle, such as an applicant deadline, nomination deadline, country round, or
   programme round. Opening and closing boundaries belong to the occurrence but
   remain separate facts.
4. A **deadline source** records the official publisher, URL, fact supported,
   scope, cycle, checked time, and retained source-timezone wording.
5. A **deadline display state** is a derived, non-authoritative result containing
   lifecycle, label, color role, and an optional countdown. It MUST be
   recomputable and MUST NOT overwrite the facts from which it was derived.

The following invariants apply:

- Every published opportunity fact MUST point to an official source, have a
  verification status, and have a last-checked timestamp.
- Source facts, curator interpretations, historical facts, and projections MUST
  remain distinguishable. A projection MUST never replace or masquerade as a
  verified current-cycle fact.
- A past date MUST remain attached to its original cycle. Annual or recurring
  wording MUST NOT cause a date to be copied into another year.
- An occurrence MUST identify its deadline role and scope. An institutional
  nomination deadline MUST NOT silently become the applicant deadline.
- Opening and closing boundaries MUST be stored and evaluated separately.
- The source timezone and original source wording MUST be retained. Viewer-local
  conversion is derived presentation data only.
- Missing, invalid, ambiguous, stale, or conflicting operative facts MUST fail
  closed: no countdown and no action-promoting display state.

## Canonical vocabularies

### Deadline precision

`DeadlinePrecision` has exactly these values:

| Value | Meaning | Dates and countdown eligibility |
| --- | --- | --- |
| `exact` | An official source gives a specific calendar date or timestamp for the identified cycle, role, and scope. “Exact” describes temporal precision, not verification. | A countdown is possible only after all verification, cycle, scope, validity, and timezone gates pass. |
| `estimated` | The source or curator provides only an approximate month, range, “usually,” “early,” “end of,” or other non-exact indication. A stored proxy endpoint remains an estimate. | MUST always show the estimate warning/label and MUST NOT receive an exact-day countdown. |
| `rolling` | Applications may be accepted continuously or without a published closing boundary for the applicable scope. Review rounds may still exist. | MUST NOT receive an invented closing date or closing countdown. A separately sourced review date is a different occurrence, not the rolling close. |
| `unknown` | No usable deadline is known. This includes absent, unclear, or unusable deadline facts when neither rolling nor a more specific scope category is established. | MUST NOT contain an inferred deadline or receive a countdown. |
| `program-specific` | There is no universal opportunity deadline because the operative deadline varies by programme, consortium call, course, or project. | Countdown allowed only for a selected, exact, verified programme occurrence whose scope matches the student. The opportunity-level value itself is not countdown-capable. |
| `institution-specific` | There is no universal opportunity deadline because the operative deadline varies by nominating, sending, or host institution. | Countdown allowed only for a selected, exact, verified institution occurrence whose scope and role match the student. The opportunity-level value itself is not countdown-capable. |

Precision and verification are orthogonal. For example, an exact date can be
unverified, stale, or conflicting; a programme-specific occurrence can contain
an exact boundary once its programme is selected without changing the
opportunity-level fact into a universal `exact` deadline.

Month ranges MUST be represented as estimated windows when possible. Their end
date MUST NOT be promoted to an exact closing date. Phrases such as “February”
or “October-November” MUST NOT be converted into the last day of a month unless
that conversion is retained solely as a clearly identified legacy proxy.

### Deadline lifecycle

`DeadlineLifecycleStatus` has exactly these values:

| Value | Entry condition |
| --- | --- |
| `not-announced` | The applicable current or future cycle is known, but an official source says its call/deadline is not yet announced, or no operative date has yet been published. Mere absence from a page is not enough to claim this state. |
| `expected-to-reopen` | No current-cycle call is verified, but retained history or an explicit recurrence statement provides reason to expect another cycle. This is a forecast, never an assertion that applications are open. |
| `opening-soon` | A fresh, verified occurrence has an opening boundary in the future and the current instant precedes it. An estimated or auto-projected opening date cannot produce this state. |
| `open` | The selected occurrence is currently accepting applications and its verified closing boundary is outside the approaching window. |
| `approaching` | The selected occurrence is open and its exact verified close is 1 through the configured approaching-window number of source-calendar days away. The initial product policy is 30 days; it MUST be one documented, testable policy value rather than scattered UI logic. |
| `due-today` | The selected occurrence is open and closes on the current calendar date in the source timezone, and, for a timed deadline, the cutoff instant has not passed. |
| `passed-current-cycle` | The verified closing boundary for the selected current cycle has passed. The state is cycle-qualified and MUST NOT imply that the enduring opportunity is discontinued. |
| `rolling` | A fresh source verifies rolling acceptance for the applicable scope and no closing boundary has been invented. |
| `temporarily-unavailable` | The current call cannot safely be acted upon because it is paused, withdrawn for the cycle, materially conflicting, structurally invalid, or otherwise temporarily unavailable. |
| `permanently-archived` | An official source or completed review establishes that the enduring opportunity is discontinued or retained only as history. A merely old page is insufficient evidence. |

Lifecycle describes the selected cycle and occurrence, not just a date's
relationship to the device clock. In particular, a previous-cycle deadline does
not become `passed-current-cycle` for a student's future target intake. When no
new cycle is published, it remains historical evidence and may support
`expected-to-reopen`; when an official future-cycle page says dates are pending,
the result is `not-announced`.

### Verification status

`DeadlineVerificationStatus` has exactly these values:

| Value | Meaning and required treatment |
| --- | --- |
| `verified` | The relevant fact was checked against an official, scope-appropriate source for the identified cycle. It requires source evidence and `lastCheckedAt`. It remains verified only through its documented review/freshness policy. |
| `unverified` | The fact has not completed official review. It cannot enable action labels, authoritative lifecycle claims, or countdowns. Legacy `not-reverified` maps to this value. |
| `stale` | A formerly reviewed fact has passed its recorded review due date, the source changed or disappeared, or the check is no longer adequate for the operative cycle. It must be rechecked. |
| `conflicting` | Two or more relevant official statements disagree materially about cycle, scope, opening, or close and no documented resolution exists. No disputed countdown is allowed. |
| `withdrawn` | An official source withdraws or cancels the call or occurrence. The current display lifecycle is `temporarily-unavailable` unless a separate decision establishes permanent discontinuation. |
| `archived` | Official evidence/review establishes that the opportunity is historical or permanently discontinued. The display lifecycle is `permanently-archived`. |
| `estimated-from-previous-cycle` | A visible forecast is derived from one or more historical cycles, not from a verified current-cycle date. It MUST remain separate from verified facts, MUST show `Deadline estimate only`, and MUST NOT receive a countdown. |

`lastCheckedAt` records when the fact was actually checked, not when a row was
imported. A verified record SHOULD also carry a review due time or explicit
freshness policy. Passing that point yields `stale`; it MUST NOT silently extend
verification. Status changes MUST retain prior evidence and an audit reason.

## Source and conflict rules

A deadline source MUST retain, at minimum, a stable source identifier, official
URL, publisher, source type, supported cycle and scope, the relevant source
wording or evidence reference, the source timezone as published, verification
status, and last-checked timestamp. A general scheme page and an operative call
page are distinct sources even when hosted on the same domain.

Official sources are evaluated by relevance, not by choosing whichever date is
earlier, later, or more convenient. A programme call may legitimately override
a general summary only when it is demonstrably authoritative for that programme,
role, scope, and cycle. An institution page may have a different nomination
deadline without contradicting an applicant deadline. Those facts become
separate scoped occurrences.

When relevant official sources truly conflict:

1. retain every source and its original claim;
2. mark the operative fact `conflicting`;
3. suppress its countdown and action-promoting label;
4. present `Verify deadline` and a non-color warning;
5. resolve only through a recorded curator decision citing scope, cycle,
   authority, and rationale; and
6. never resolve automatically by taking the minimum, maximum, newest page, or
   previously stored value.

A user-entered personal reminder is not an official deadline source. It may be
tracked separately but MUST NOT alter the catalogue occurrence, verification
status, lifecycle, or public countdown.

## Cycle, target-intake, and student rules

### Cycle identity and intake relationship

A `DeadlineCycle` MUST have a stable identifier and SHOULD record the source's
cycle label, application-cycle start/end, and one or more target-intake IDs. The
cycle label may be an academic year such as 2026/27; it must not be inferred
from the closing date's year.

For evaluation, an occurrence is classified relative to the student's selected
target intake:

- **current intake**: the cycle explicitly applies to that target intake;
- **future intake**: the cycle explicitly applies to an intake after the selected
  target intake or, when no student intake is selected, after the platform's
  documented current intake;
- **previous intake**: the cycle applies to an earlier intake.

Calendar proximity cannot substitute for an explicit intake relationship. A
2026 application deadline may fund a 2027 start, and a programme starting in
2026 may have closed in 2025. Filters and lifecycle evaluation MUST use the
cycle/intake relation rather than rewriting the year.

A previous-intake occurrence MUST remain historical and MUST NOT trigger
`Apply now`. A future-intake occurrence MAY be `opening-soon` only when its own
opening fact is verified; otherwise it is `not-announced` or
`expected-to-reopen` as supported. When a current-intake cycle exists, it takes
selection precedence over historical or speculative cycles.

### Expected graduation and final-year eligibility

Expected graduation is an eligibility input, not a deadline. The system MUST
keep `expectedGraduationDate`, `applicationClosingBoundary`, admission or degree
completion cutoff, and `programStartDate` as separate facts.
The program start date and application deadline MUST never be conflated.

- A final-year student is provisionally eligible only if the official rules
  permit pending completion and the expected graduation date is on or before the
  rule's explicit completion/admission/enrolment cutoff.
- If the rules require the qualifying degree by programme start and no earlier
  cutoff is stated, expected graduation on or before the programme start may
  satisfy this timing check; graduation after programme start does not.
- The application deadline MUST NOT be used as the graduation cutoff unless the
  official eligibility rule explicitly says so.
- Missing or imprecise graduation/rule data produces **eligibility unknown**, not
  automatic eligibility or ineligibility, and it does not change a deadline.
- Passing the timing check does not prove overall eligibility; all other official
  requirements still apply.

## Occurrences, multiple deadlines, and recurrence

### Scope-aware multiple deadlines

Each application or nomination event MUST be a separate occurrence. An
occurrence SHOULD identify:

- cycle and target intake;
- role, such as applicant submission, institutional nomination, embassy
  nomination, programme round, or document supplement;
- programme, institution, country/residency, applicant category, and round scope;
- opening boundary and closing boundary as separate optional values;
- precision, verification, source links, source timezone, and original wording;
- whether the boundary is date-only or timed; and
- supersession/withdrawal history.

Multiple deadlines MUST NOT be represented only as an unlabelled array. Stored
order is not meaning. A selector MUST first match cycle and target intake, then
role and all known student scopes. It MUST exclude occurrences that positively
conflict with the student's scope. It may choose the next actionable occurrence
only after matching; it MUST NOT globally choose the first, earliest, or latest
date.

If multiple matched rounds are genuinely available, the platform SHOULD retain
and expose all of them and may designate the next open/future round as primary.
If two candidates have indistinguishable scope but different operative dates,
the result is ambiguous or `conflicting`, not an arbitrary selection. If the
required student scope is unknown, return `Verify deadline` and no countdown
rather than assuming a programme or institution.

Opening and closing boundaries are independent facts. A verified close does not
authorize inventing an opening date, and an opening date does not authorize
inventing a close. A document deadline, interview date, decision date, or review
meeting MUST NOT be treated as an application close.

### Recurring and annual deadlines

Recurrence is descriptive metadata, not a date generator. A rule such as annual,
monthly review, or “usually November” MAY be retained with its evidence, but a
future `DeadlineOccurrence` MUST **never be materialized automatically** from it.

- A verified 2026 date remains a 2026-cycle fact after it passes.
- No process may add one year, substitute the current year, or copy month/day
  values into 2027 without a new official source check.
- Historical patterns may produce `expected-to-reopen` and verification status
  `estimated-from-previous-cycle`; they cannot produce `opening-soon`, `open`,
  `approaching`, `due-today`, `verified`, or an exact countdown.
- A newly published cycle receives a new occurrence linked to its source. It
  does not mutate the historical occurrence.
- Rolling acceptance and recurring review rounds are separate facts. A rolling
  opportunity may have dated review rounds without acquiring an invented final
  close.

## Date, timezone, and boundary semantics

### Representation

Dates MUST use strict Gregorian ISO calendar form `YYYY-MM-DD`. Timed boundaries
MUST contain an unambiguous instant (ISO 8601 timestamp with offset) and retain
the official IANA timezone, when one is stated, because an offset alone does not
encode future daylight-saving rules. The original deadline text and timezone
designation MUST also be retained as evidence.

An exact date MUST NOT be inferred from a month, month range, application window,
historical tendency, or programme/institution variation. Estimated windows
SHOULD retain start and end when known, their estimation basis, and an estimate
warning; a proxy end date MUST remain explicitly marked as a proxy.

For a **date-only opening**, acceptance begins at 00:00 at the start of that date
in the source timezone. For a **date-only closing**, applications are treated as
open through that source calendar date and close at 00:00 at the start of the
following source calendar date (an exclusive boundary). If the official source
defines another convention, such as office hours, that exact convention must be
stored instead of applying the date-only default.

For a **timed boundary**, compare the current instant with the stored instant.
The source-zone calendar date is still used for student-facing “today” and
calendar-day language. Once the cutoff instant passes, the occurrence is passed
even if the viewer's or source's calendar date has not ended.

If an otherwise exact date lacks a source timezone, the value may be retained
for review but is not safe for a production countdown or boundary-sensitive
action label. The system MUST NOT silently substitute the server, browser, or
provider-country timezone.

### Source timezone versus viewer timezone

Lifecycle and countdown arithmetic are authoritative in the source timezone.
The primary display MUST show the source date/time and timezone. A conversion to
the student's timezone MAY be shown secondarily (for example, “your local
time”), but it MUST NOT overwrite the source value, change the cycle, or become
the basis for the canonical lifecycle.

Viewer-local midnight alone MUST NOT change the canonical state. State changes
when the relevant source-zone date or exact cutoff boundary changes. A deadline
may therefore be “due today” in the source zone while its secondary local
conversion falls on the previous or following local date; both facts should be
made explicit.

Calendar arithmetic MUST use timezone-aware calendar operations. It MUST NOT
divide elapsed milliseconds by `86,400,000`: daylight-saving days may contain
23 or 25 hours. Gregorian calendar validation MUST handle leap years, including
February 29 (divisible by 4 except centuries not divisible by 400).

## Countdown rules

A countdown is permitted only when all of these gates pass:

1. exactly one applicable cycle and scope-aware occurrence has been selected;
2. its operative boundary is valid and truly exact (including an exact boundary
   inside a resolved `program-specific` or `institution-specific` occurrence);
3. verification is fresh `verified`, not `unverified`, `stale`, `conflicting`,
   `withdrawn`, `archived`, or `estimated-from-previous-cycle`;
4. the source timezone/cutoff convention is known;
5. the occurrence belongs to the relevant target intake and deadline role; and
6. lifecycle is one for which the relevant opening/closing countdown is defined.

Failure of any gate yields no numeric countdown. In particular:

- `estimated` always displays an estimate warning and no exact-day countdown;
- `rolling` has no closing countdown unless an official closing occurrence is
  separately published, at which point it is no longer an invented rolling
  close;
- `unknown` has no countdown;
- unresolved programme/institution scope has no countdown; and
- missing, malformed, impossible, unordered, or ambiguous operative data has no
  countdown, is recorded as a validation/audit issue, and safely falls back to
  `temporarily-unavailable` plus `Verify deadline` where a display is required.

The allowed countdown forms are:

| Condition in source timezone | Countdown result |
| --- | --- |
| Before a verified opening boundary | Calendar days until opening; the copy MUST say it counts to opening, not closing. |
| Open and closing date is later than today | **Days remaining** equals the number of Gregorian source-calendar date boundaries from today to the closing date. |
| Open and closing date is today, before its exclusive/date-time cutoff | **Deadline today**; numeric days remaining is zero. |
| After the close in the selected current cycle | **Days since deadline** equals the number of source-calendar dates after the closing date. Immediately after a timed cutoff on the same source date, use “passed today” rather than the misleading “0 days ago.” |

For date-only values, implementations should compute day differences using a
calendar ordinal or a date library's calendar-day operation in the source zone.
For timed values, instant comparison decides open/passed, while source-calendar
ordinals decide the displayed day count. Leap day and DST tests are mandatory.

Countdowns are derived at render/evaluation time and SHOULD refresh at the exact
next relevant source boundary, with a conservative periodic fallback. A
60-second timer is not the definition of correctness. Invalid dates MUST never
produce `NaN`, an exception-visible page, or a plausible-looking countdown.

## Lifecycle, label, countdown, and color decision precedence

A conforming evaluator MUST apply this order so different screens cannot invent
different meanings:

1. **Validate structure.** Reject/quarantine malformed calendar values,
   impossible boundaries, missing required links, or closing-before-opening.
2. **Resolve cycle and scope.** Match target intake, role, programme,
   institution, country/category, and round. Never select by raw array order.
3. **Apply terminal availability.** `archived` yields
   `permanently-archived`; `withdrawn` yields `temporarily-unavailable` unless
   separately proven permanent. Material unresolved conflicts and structural
   contradictions yield `temporarily-unavailable`.
4. **Apply rolling semantics.** A fresh verified rolling fact yields `rolling`;
   it is evaluated before closing-date logic because it has no invented close.
5. **Resolve announcement/opening.** With no usable current-cycle close, use
   `not-announced` only from current official evidence and
   `expected-to-reopen` only from explicit/historical expectation. A verified
   future opening yields `opening-soon`.
6. **Compare the operative boundary.** For a selected valid occurrence, derive
   `open`, `approaching`, `due-today`, or `passed-current-cycle` using source-zone
   rules and the configured approaching window.
7. **Choose the primary student-facing label** using the exact precedence below.
8. **Run countdown gates.** Lifecycle alone never authorizes a countdown.
9. **Choose semantic color** using lifecycle plus confidence; confidence can
   downgrade a color but never upgrade the underlying fact.

This precedence permits lifecycle to describe a mechanically selected occurrence
while verification blocks action. For example, an unverified exact date may be
temporally in the future, but it still receives `Verify deadline`, no countdown,
and a neutral verification color—not `Apply now` and not green.

## Student-facing labels

`DeadlineStudentLabel` has exactly these English values:

- `Apply now`
- `Prepare now`
- `Wait for next cycle`
- `Verify deadline`
- `Rolling opportunity`
- `Deadline passed for this cycle`
- `Not yet announced`
- `Deadline estimate only`

Exactly one primary deadline label is selected in this order:

1. Structural invalidity, material `conflicting`, `withdrawn`, `archived`, or a
   `temporarily-unavailable`/`permanently-archived` display yields
   `Verify deadline`. The lifecycle or availability reason MUST also be exposed;
   the label is not an invitation to apply.
2. Precision `estimated` or verification
   `estimated-from-previous-cycle` yields `Deadline estimate only`, with a visible
   verification requirement. This ensures uncertainty is never hidden by a
   more optimistic temporal state.
3. Verification `unverified` or `stale`, precision `unknown`, unresolved
   `program-specific`/`institution-specific` scope, or missing timezone yields
   `Verify deadline`.
4. Fresh verified lifecycle `rolling` yields `Rolling opportunity`.
5. `not-announced` yields `Not yet announced`.
6. `expected-to-reopen` yields `Wait for next cycle`.
7. `opening-soon` yields `Prepare now`.
8. `passed-current-cycle` yields `Deadline passed for this cycle`.
9. Fresh verified `open`, `approaching`, or `due-today` yields `Apply now`.

Labels do not replace the precise source date, cycle, scope, verification badge,
last-checked date, or lifecycle description. “Apply now” means only that the
deadline gate appears actionable; it is not an eligibility decision and must
never trigger autonomous application submission.

## Semantic display-color and accessibility rules

Color is a derived semantic role, not stored deadline truth:

| Semantic role | Allowed use |
| --- | --- |
| Green / positive | Only fresh verified, scope-resolved `open` deadlines outside the approaching window. “Sufficiently reliable” means the same formal gates required for action; an exact-looking unverified value is not sufficiently reliable. |
| Amber / urgent | Fresh verified `approaching` and `due-today` occurrences. Urgency MUST include text and an icon. |
| Red / elapsed | Fresh sufficiently reliable `passed-current-cycle` occurrences only. Historical dates for a different intake and unverified legacy dates MUST NOT be painted as authoritative current-cycle failures. |
| Blue / informational | Verified `rolling`, `opening-soon`, and clearly marked estimates where blue is distinguishable from action states. |
| Grey / neutral | `unknown`, scope unresolved, unverified, stale, conflicting, unavailable, or archived states. Grey may replace blue when verification attention is the primary meaning. |

Confidence always wins over temporal urgency for color: an unverified date that
appears close is grey/neutral, not amber; an unverified old date is grey/neutral,
not red. Estimates must remain blue or grey, never green or amber.

Color MUST never be the only status indicator. Every state requires visible text
and a non-color cue such as an icon or pattern. Normal text and meaningful icons
must meet WCAG contrast requirements (at least 4.5:1 for normal text and 3:1 for
large text/non-text UI components). Status must remain understandable in dark
mode, high-contrast/forced-colors mode, grayscale, and common color-vision
deficiencies. Assistive technology must receive the label, date, source
timezone, verification, and uncertainty in a coherent accessible name or
description. Countdown updates must not create disruptive repeated live-region
announcements.

## Reconciliation with the v0.1 migration seed

The versioned seed is a preserved migration artifact, not an implementation of
this full model. It currently contains 55 records with only four precision
values: 24 `exact`, 20 `estimated`, 5 `rolling`, and 6 `unknown`. It has no
`program-specific` or `institution-specific` enum values even though some
`rawText` describes those variations.

All stored dates are in 2026. Exact and estimated rows use `cycleYear: 2026`;
rolling and unknown rows use a null cycle year. All deadline timezones are null,
and all sources use legacy verification value `not-reverified`. For domain
evaluation, `not-reverified` MUST map one-way to `unverified`; it must never map
to `verified`. The seed also lacks occurrence IDs, target intake, deadline role,
scopes, separate opening facts, datetime cutoffs, recurrence evidence, and
field-level official sources.

Consequences under this specification:

- None of the 55 seed records is eligible for an authoritative production
  countdown, green/amber/red temporal color, or `Apply now` without official
  review and missing context.
- The 24 exact dates remain exact-looking legacy assertions, but null timezone
  and unverified status block countdowns.
- The 20 estimated proxy dates MUST show `Deadline estimate only`, MUST retain
  their guide wording, and MUST NOT be counted as exact deadlines.
- The 5 rolling rows retain no invented close and are not labelled
  `Rolling opportunity` until rolling status is officially verified; before
  that, they require verification.
- The 6 unknown rows receive no countdown. Programme/institution/country/call
  variations in their raw text must be reviewed into scoped occurrences rather
  than guessed.
- Unlabelled arrays containing two dates must be decomposed into source-backed,
  role- and scope-aware occurrences before either date becomes actionable.
- No 2026 date may be automatically copied, incremented, or materialized as a
  2027 occurrence. Passed 2026 values remain attached to their historical cycle
  pending next-cycle verification.

Compatibility SHOULD be implemented later through a non-destructive adapter or
explicit migration. This specification does not authorize changing the v0.1
seed or treating `deadline.dates[0]` as the production selection algorithm.

## Conformance checklist

An implementation conforms only if automated scenarios demonstrate all of the
following:

- all six precision values and all ten lifecycle values are exhaustive;
- all seven verification values are exhaustive, including the legacy
  `not-reverified` to `unverified` mapping;
- all eight student-facing labels are emitted only through the stated
  precedence;
- exact, estimated, rolling, unknown, programme-specific, and
  institution-specific records obey their countdown gates;
- date-only and timed boundaries are tested before, at, and after their source
  boundary, including a viewer in a different timezone;
- source midnight and viewer midnight are tested independently;
- leap years and 23-/25-hour daylight-saving days are evaluated with calendar
  arithmetic and never fixed 86,400,000-millisecond division;
- malformed, missing, contradictory, unordered, duplicate, and conflicting data
  fail closed without a plausible countdown;
- opening and closing facts are separate and multiple occurrences are selected
  by cycle, role, and scope rather than array position;
- current, previous, and future target intakes remain distinct;
- recurring/annual history never materializes a future occurrence automatically;
- final-year timing is evaluated against the official completion/program-start
  rule, not assumed from the application deadline; and
- every color state is reinforced by text and a non-color cue and remains usable
  with assistive technology and forced colors.
