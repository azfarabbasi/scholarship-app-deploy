# Checkpoint 0 deadline audit report

## Scope and method

This report audits the deadline fields in
`data/migrations/v0.1/scholarships.seed.json` as of **2026-07-12**. It is a
read-only review of the migrated legacy data. No opportunity fact was checked
against the internet or an official source, and this report must not be read as
current scholarship guidance.

The accompanying `scripts/audit-deadlines.ts` script validates each record with
the opportunity seed Zod schema, then applies deadline-specific structural,
readiness, and policy checks. Structural contradictions fail the script;
readiness warnings do not. Date comparisons use strict `YYYY-MM-DD` calendar
values and consider a date expired only when it is earlier than the audit date.

## Result

The fixed checkpoint run has **zero structural errors** across all **55** seed
records. The dataset is internally consistent, but it is not publication-ready:
all records remain unverified, all lack a deadline timezone, 30 dated 2026
records have only past stored dates, and 11 records are undated. Therefore, 41
records require next-cycle verification as of 2026-07-12.

| Measure | Count |
| --- | ---: |
| Records audited | 55 |
| Structural errors | 0 |
| Exact | 24 |
| Estimated | 20 |
| Rolling | 5 |
| Unknown | 6 |
| Dated records with only past 2026 dates | 30 |
| Undated records | 11 |
| Records requiring next-cycle verification | 41 |
| Missing deadline timezone | 55 |
| `not-reverified` | 55 |
| Automatic rollover allowed | 0 |

## Precision inventory

The precision labels are complete and supported for all records.

| Precision | Count | Legacy IDs |
| --- | ---: | --- |
| Exact | 24 | 3, 4, 5, 7, 11, 12, 13, 14, 15, 16, 17, 20, 25, 26, 28, 29, 30, 31, 32, 34, 41, 42, 43, 54 |
| Estimated | 20 | 1, 8, 9, 10, 21, 22, 23, 33, 35, 36, 37, 38, 39, 40, 44, 46, 47, 51, 52, 55 |
| Rolling | 5 | 2, 6, 27, 45, 53 |
| Unknown | 6 | 18, 19, 24, 48, 49, 50 |

All 20 estimated records include a migration note that explicitly retains the
estimated/unverified character of the stored date. No broad, rolling, or unknown
deadline was silently upgraded to an exact date.

## Structural checks

Every structural category returned zero findings:

- schema-invalid records: 0
- dates with missing or unsupported precision: 0
- rolling deadlines containing dates: 0
- unknown deadlines containing dates: 0
- malformed strict calendar dates: 0
- cycle-year mismatches: 0
- unordered multi-date arrays: 0
- duplicate dates within a record: 0
- estimated records missing an estimate warning/note: 0

These results establish internal migration consistency only. They do not verify
that any stored deadline is still offered, accurate, or applicable to a
particular applicant.

## Warning inventory

### Expired stored 2026 dates: 30

Each record below is dated, has `cycleYear: 2026`, and has no stored date on or
after 2026-07-12. “Expired” refers only to the migrated date value, not to a
freshly verified official deadline.

1. ID 9 — Holland Scholarship
2. ID 10 — Erasmus University Rotterdam Excellence Scholarship
3. ID 12 — Wageningen University Scholarship
4. ID 13 — Utrecht Excellence Scholarship
5. ID 14 — Swedish Institute Scholarships for Global Professionals (SISGP)
6. ID 15 — Lund University Global Scholarship
7. ID 16 — Stockholm University Academic Merit Scholarship
8. ID 17 — KTH Royal Institute of Technology Scholarship
9. ID 20 — NTNU International Master's Scholarships
10. ID 21 — Eiffel Excellence Scholarship Program
11. ID 23 — Université Paris-Saclay International Master's Scholarships
12. ID 25 — DTU Scholarship
13. ID 26 — Copenhagen University Excellence Scholarships
14. ID 28 — University of Helsinki Scholarship Programme
15. ID 29 — Aalto University Scholarships
16. ID 32 — University of Vienna Merit Scholarship
17. ID 35 — EPFL Excellence Fellowships
18. ID 36 — Italian Government Scholarships (Farnesina)
19. ID 37 — University of Bologna UNIBO Action 2 Scholarship
20. ID 38 — Politecnico di Milano International Fellowships
21. ID 39 — Becas España Scholarships (MAEC-AECID)
22. ID 40 — La Caixa Fellowship Programme
23. ID 41 — VLIR-UOS Scholarships
24. ID 42 — KU Leuven Scholarships
25. ID 44 — Polish Government Scholarships (NAWA)
26. ID 47 — Erasmus Mundus Joint Master Degrees (EMJMD)
27. ID 51 — EUNICE Alliance Scholarships
28. ID 52 — Central European University Scholarships
29. ID 54 — Jacobs University Bremen Merit Scholarships
30. ID 55 — EIT Digital Master School Scholarships

### Undated records: 11

Rolling and unknown records correctly contain no invented dates, but each still
needs an official-source review before publication:

1. ID 2 — Helmholtz Research School Fellowships
2. ID 6 — Alexander von Humboldt Research Fellowship
3. ID 18 — Norwegian Government Scholarship
4. ID 19 — University of Oslo Scholarship (EUTOPIA)
5. ID 24 — French Government Scholarships (BGF)
6. ID 27 — Aarhus University GSST Scholarship
7. ID 45 — FCT Scholarships
8. ID 48 — Marie Skłodowska-Curie Doctoral Networks (MSCA)
9. ID 49 — ERC Starting Grant
10. ID 50 — Horizon Europe Research Grants
11. ID 53 — IMPRS (Max Planck) PhD Fellowships

The 30 expired dated records and these 11 undated records form the **41-record
next-cycle verification queue**. The remaining 14 records merely have at least
one stored date on or after the audit date; they are still `not-reverified` and
must not be presented as officially current.

### Missing timezones and verification evidence: 55 each

Every record, IDs **1–55**, has `deadline.timezone: null`,
`verificationStatus: "not-reverified"`, and `lastCheckedAt: null`. Titles and IDs
are the full seed inventory. A date without an official timezone can support
calendar-level display, but not a reliable closing instant or hour-level
countdown. The absence of official re-verification is a publication blocker even
for dates that have not yet passed.

### Raw-text deadline-scope candidates: 16

The model does not yet encode whether a deadline applies globally or varies by
program, institution, country, consortium, or call. The audit uses a conservative
keyword scan of `deadline.rawText`; it does not infer a formal category. These
records need manual classification:

1. ID 1 — DAAD Scholarships for Foreign Students — “Varies by program”
2. ID 2 — Helmholtz Research School Fellowships — “program-specific”
3. ID 9 — Holland Scholarship — “most universities”
4. ID 18 — Norwegian Government Scholarship — “Varies by institution”
5. ID 19 — University of Oslo Scholarship (EUTOPIA) — “Program-specific”
6. ID 21 — Eiffel Excellence Scholarship Program — “Institutional deadline”
7. ID 24 — French Government Scholarships (BGF) — “Varies by country”
8. ID 33 — Swiss Government Excellence Scholarships — “varies by country”
9. ID 35 — EPFL Excellence Fellowships — “Program-specific”
10. ID 36 — Italian Government Scholarships (Farnesina) — “varies by country”
11. ID 45 — FCT Scholarships — “annual call”
12. ID 47 — Erasmus Mundus Joint Master Degrees (EMJMD) — “most programs”
13. ID 48 — Marie Skłodowska-Curie Doctoral Networks (MSCA) — “consortium call”
14. ID 49 — ERC Starting Grant — “annual” call
15. ID 50 — Horizon Europe Research Grants — “annual calls”
16. ID 53 — IMPRS (Max Planck) PhD Fellowships — “program-specific”

This is deliberately narrower than a semantic classification. Other raw text may
also require formal scoping during verification.

## Automatic rollover policy

Automatic rollover is forbidden for **all 55 records (IDs 1–55)**. No code may
advance a 2026 date to 2027, copy a month/day into another cycle, or convert an
undated record into a dated one without official evidence. A future-cycle date
must be a new verified fact with its own official source, verification status,
and last-checked timestamp.

## Limitations

- This audit checks the migration dataset, not live opportunity pages.
- The legacy prototype provides no trustworthy verification timestamps.
- All deadline timezones are absent, so exact closing instants and countdowns
  cannot be established.
- Date scope is embedded in free text rather than a structured program,
  institution, country, consortium, or call relationship.
- A single `cycleYear` cannot describe every future multi-cycle or call-based
  opportunity without further modelling.
- “Exact” means exact in the legacy representation; it does not mean officially
  reverified for production.
- Expiry and next-cycle findings are derived from stored dates and the audit date
  only. They make no claim about whether an opportunity is currently open.

## Checkpoint 1 recommendations

1. Create a manual official-source verification queue, prioritising the 41
   next-cycle records and then the remaining 14 dated records.
2. Record an official source URL, verification status, and ISO timestamp for every
   fact accepted for publication.
3. Add a structured deadline-scope model, such as global, program, institution,
   country, consortium, call, and unknown, without inferring values from names.
4. Capture the official timezone or explicit “timezone not published” evidence;
   avoid hour-level countdowns until that field is trustworthy.
5. Model deadline observations by cycle/call rather than mutating migrated dates.
6. Keep estimated, rolling, and unknown labels visible to users and expose the
   last-checked date near deadline information.
7. Add regression fixtures for leap days, invalid calendar dates, mixed-year date
   arrays, duplicate dates, unordered dates, and rolling/unknown contradictions.

## Blockers before publication

- All 55 opportunity records are still `not-reverified`.
- All 55 records lack deadline timezone evidence.
- The 41-record next-cycle queue has no current dated evidence in this seed.
- Program/institution/country/call scope is not formally encoded.
- No automatic rollover mechanism may be used to fill these gaps.

The dataset can proceed as a controlled migration artifact, but deadline facts
must not be promoted as current production guidance until these blockers are
resolved through manual official-source verification.
