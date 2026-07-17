# Eligibility & matching spec

The full design of the optional eligibility questionnaire and the deterministic matching engine
that reads it — what it collects, what it deliberately never collects, exactly how each of the
seven match labels is reached, and the cautious-language rules the UI must never violate.

## The questionnaire

`src/lib/schemas/eligibility-answers.ts`'s `eligibilityAnswersSchema` is `.strict()` — an
unrecognised key is rejected outright, not silently accepted. Every field is optional/nullable:
countryOfResidence, nationality, currentStudyLevel, intendedStudyLevel, fieldsOfInterest (≤20),
graduationYear, targetIntakeYear, targetIntakeTerm, preferredCountries (≤30), preferredRegions
(≤20), languageTestStatus (`have-valid-result | booked | planned | none`), researchExperience
(`yes | no | unknown`), workExperienceYears, finalYearStatus (`yes | no | unknown`),
fundingPreference (`fully-funded-only | partial-ok | any`), studyMode (`on-campus | remote |
either`).

**Deliberately never collected, and rejected by the strict schema if attempted:** passport or ID
numbers, full address, financial documents, medical data, religious/ethnic identity, or
transcript/CV/recommendation-letter contents. Nationality and country of residence are the two
most identity-adjacent fields collected, and only because official eligibility rules frequently
key on them directly — the form marks both optional and explains why, right next to the field.

`resolveAnswers(input)` fills in the full `EligibilityAnswers` shape (every field defaulted to
`null`/`[]`) from a possibly-partial `EligibilityAnswersInput`, and `answersAreEmpty(answers)`
detects the "nothing answered yet" case — used to distinguish "not-enough-rule-data" (nothing
answered) from "missing-information" (answered something, still not enough for this opportunity).

## The matching engine

`src/lib/matching/engine.ts`'s `evaluateMatch(opportunity, answers, planning, deadlineEvaluation)`
is the single entry point: pure, deterministic, never throws, always returns a fully-populated
`MatchResult`. No AI, no network call, no randomness — the same four inputs always produce the
same output, which is exactly what makes it auditable and testable
(`tests/unit/matching-engine.test.ts`, 26 cases covering every label branch and rule operator).

### Reason sources are never conflated

Every reason carries a `source` tag: `eligibility-rule` (a formal, staff-authored, structured
rule), `preference` (the student's own planning preferences — study level/country — a much softer
signal), `deadline`, or `verification`. The UI (`MatchReasonsPanel.tsx`) groups reasons by outcome
(positive/mismatch/warning/missing-info) but always shows the source tag alongside each one, so a
student can never mistake "this matches your stated preference" for "this satisfies an official
rule."

### Per-rule evaluation — never guesses

For each of an opportunity's active, published eligibility rules, `evaluateRule()` maps the rule's
`kind` to a comparison against the corresponding answer field:

| Rule kind | Compared against | Comparator |
| --- | --- | --- |
| `nationality` | `nationality` | string-set membership (`in`/`not-in`/`equals`/`not-equals`) |
| `residence` | `countryOfResidence` | same |
| `study-level` | `currentStudyLevel` ∪ `intendedStudyLevel` | array-intersection |
| `field-of-study` | `fieldsOfInterest` | array-intersection |
| `graduation-date` | `graduationYear` | numeric comparator (`greater-than(-or-equal)`, `less-than(-or-equal)`, `equals`, `not-equals`) |
| `language-test` | `languageTestStatus` | special-cased: `have-valid-result` → match, anything else answered → mismatch, unanswered → missing |
| `research-experience` | `researchExperience` | yes/no comparator, `unknown` treated as unanswered |
| `work-experience` | `workExperienceYears` | numeric comparator |
| `academic-score`, `age`, `institution`, `programme`, `other` | — | **always `"missing"`**, regardless of any answer |

That last row is the load-bearing guarantee: rule kinds this engine cannot map to a comparable
field with confidence resolve to `"missing"` unconditionally — never a guessed match, never a
guessed mismatch, even if every other field is filled in. This is why every opportunity in the
current seed dataset (whose one legacy-imported rule is always `kind: "other"`) reads as
"Missing information": there is a genuine formal rule, but this engine has no comparable
structured field for it, and says so honestly rather than fabricating a verdict.

### The seven labels

| Label | Reached when | Confidence |
| --- | --- | --- |
| `likely-not-a-fit` | Any rule mismatches (checked first — a mismatch overrides everything else, including a passed deadline) | `high` if mismatches outnumber matches, else `medium` |
| `deadline-risk` | No mismatch, but the opportunity's current cycle has passed/is due today | `medium` |
| `not-enough-rule-data` | No structured rules at all, no preference overlap, and the student hasn't answered anything | `low` |
| `missing-information` | Either: no rules + no preference overlap + some answers given; or: rules exist but none matched and at least one was unanswerable | `low` |
| `possible-fit` | No rules but a preference overlaps; or: at least one rule matched and at least one is still missing | `low` (no-rules case) / `medium` (partial-rule case) |
| `needs-verification` | Every rule matched, but the opportunity's eligibility data isn't independently verified yet | `medium` |
| `strong-potential-fit` | Every rule matched, and the eligibility data is verified | `high` |

Planning-preference overlap (study level, country) only ever feeds the **no-structured-rules**
branch — once an opportunity has ≥1 real rule, preference signals still surface as extra
`positiveReasons`/`warningReasons`, but they never change the label, so a formal rule mismatch can
never be quietly overridden by "well, the country matches."

### Deadline and verification notes — separate from the label

`deadlineNotes` fire independently of the label: "estimated or unverified" when
`deadlineEvaluation.verificationRequired`, "multiple deadline dates were found" when
`deadlineEvaluation.multipleDeadlines`. `verificationNotes` fire when the opportunity's overall
verification status is `unverified`/`stale`, and separately when the opportunity has ≥1 rule but
its eligibility data specifically isn't verified. These are always additive context, never a
replacement for checking the label logic above.

### The disclaimer, and cautious language throughout

Every `MatchResult` carries the exact same `MATCH_DISCLAIMER` string
(`src/lib/matching/types.ts`): *"This is a planning aid based on stored rules and your own
answers — never a guarantee of eligibility, admission, or funding. Always verify with the official
source before applying."* It is rendered on every card/detail-page/comparison-row match display,
unconditionally — there is no code path that shows a match label without it. `nextAction` text is
label-specific but always points back to the official source or the eligibility form, never
implies a decision has been made on the student's behalf.

## What this engine is not

- Not AI, not a scoring model, not probabilistic — every branch above is a fixed `if`/`switch`,
  reproducible by hand from the same inputs.
- Not a substitute for reading the official eligibility page — the disclaimer says so on every
  single result, and `likely-not-a-fit`'s own `nextAction` explicitly says to check the official
  source "before ruling this out entirely."
- Not persisted anywhere as a standalone "score" — `MatchResult` is computed fresh on render from
  the student's current answers/preferences and the opportunity's current data; there is no
  `eligibilityScore`/`aiSuggested` column anywhere in the schema (checked structurally by
  `scripts/validate-checkpoint4.ts`).
