# Checkpoint 0: Legacy scholarship dataset inventory

## Scope and status

This is a read-only inventory of the static prototype's scholarship catalogue. No records have been copied into the production application, no production schema has been created, and no migration has been performed.

- Audit date: **2026-07-12**
- Primary dataset inspected: `ScholarTrack_Europe/data.js` (`window.SCHOLARSHIPS`)
- Consumer logic inspected for field semantics: `ScholarTrack_Europe/app.js`
- Dataset description and provenance warning inspected: `ScholarTrack_Europe/README.txt`
- Primary file fingerprint at audit time (SHA-256): `1F4BBE3344ACA979FF4286A1BEA6B746BA237CF3564AC91560DC56951EFF9497`

The legacy folder was inspected only. It was not modified.

## Methodology

The right-hand side of `window.SCHOLARSHIPS` was parsed as its JSON-compatible array and checked programmatically for record count, property presence, nulls, empty values, types, uniqueness, deadline formats, precision values, and category counts. The deadline comparison below uses the audit date as a local calendar date. `app.js` was then read to confirm how the prototype consumes `precision` and `deadlineDates`.

No remote URL or scholarship fact was verified during this checkpoint. An HTTPS-looking URL string is therefore reported only as a URL, not as proof that the page is reachable, current, official, or supports every claim in the record.

## Snapshot summary

| Measure | Finding |
| --- | --- |
| Scholarship records | **55** |
| Legacy IDs | Integers **1–55**, all unique |
| Record properties | **10** properties; every property is present on all 55 records |
| Null values | **0** |
| Empty strings | **0** |
| Unique names | **55 of 55** |
| Unique URLs | **55 of 55** |
| HTTPS URL strings | **55 of 55**; reachability and authority not checked |
| Records with one or more stored dates | **44 of 55 (80.0%)** |
| Records with no stored dates | **11 of 55 (20.0%)** |
| Total stored date values | **48** |
| Stored date format | All 48 match `YYYY-MM-DD` and parse as calendar dates |
| Stored date years | **2026 only** |

## Fields currently present

| Field | Legacy type | Coverage | Current meaning and constraints |
| --- | --- | ---: | --- |
| `id` | integer | 55/55 | Sequential local identifier from 1 through 55. It has no namespace or source-system identity. |
| `name` | string | 55/55 | Display title. Unique in this snapshot, but not a safe permanent identity. |
| `country` | string | 55/55 | Free-text location/jurisdiction label; it can contain one country, multiple countries, a country plus `EU`, or `EU-wide`. |
| `benefit` | string | 55/55 | Prose description combining amounts, currencies, cadence, tuition coverage, insurance, travel, and qualifiers. |
| `eligibility` | string | 55/55 | Prose summary combining degree, nationality/residency, subject, merit, work experience, age, admission, and other rules. |
| `deadlineText` | string | 55/55 | Human-readable guide wording, including exact days, month ranges, rolling calls, and program-specific or unknown dates. |
| `deadlineDates` | string array | 55/55 | Zero, one, or two ISO-like calendar dates. It is non-empty on 44 records and empty on 11; there are 48 values total. |
| `precision` | string enum in practice | 55/55 | One of `exact`, `estimated`, `rolling`, or `unknown`. No schema enforces the vocabulary. |
| `levels` | string array | 55/55 | One to three values chosen from `Bachelor`, `Master`, `PhD`, `Postdoc`, `Research`, and `Exchange`. |
| `url` | string | 55/55 | A single HTTPS page associated with the record. It does not distinguish a fact source from an application page. |

Relative to the legacy ten-field shape, there are no omitted properties, nulls, or empty strings. The only empty collections are the 11 `deadlineDates` arrays, and they correspond exactly to the five `rolling` plus six `unknown` records.

The legacy data has no formal schema declaring optional fields. Observationally, `deadlineDates` is the only field allowed to carry no values (11/55 records); the other nine fields are populated on all 55 records, and every `levels` array is non-empty.

## Missing production fields

The following concepts do not exist as fields on any of the 55 records. “Missing” here means absent from the legacy model, not necessarily applicable to every opportunity.

| Missing concept | Coverage absent | Why it is needed |
| --- | ---: | --- |
| Official-source classification and field-level provenance | 55/55 | A URL alone cannot show which claims it supports or whether it is an official source. |
| Verification status and `lastCheckedAt` | 55/55 | Required to distinguish unreviewed, verified, stale, and disputed facts. |
| Provider/awarding organisation | 55/55 | Provider names are embedded inconsistently in titles and cannot be related or updated independently. |
| Opportunity type | 55/55 | Scholarships, fellowships, mobility awards, tuition policies, doctoral jobs/networks, and research grants are mixed together. |
| Application URL and application route | 55/55 | The one `url` is not typed; direct, institutional nomination, embassy, consortium, and programme-specific routes differ. |
| Application cycle/intake/academic year | 55/55 | Every stored date is pinned to 2026 without an explicit cycle identity. |
| Deadline type, opening date, timezone, and recurrence | 55/55 | Applicant, institutional, nomination, annual-call, and review dates cannot be distinguished. |
| Structured estimated window | 55/55 | A range start/end and estimation rationale are lost when a broad guide window becomes one proxy date. |
| Lifecycle status | 55/55 | There is no authoritative `active`, `closed`, `paused`, `superseded`, or `archived` state. |
| Structured locations and jurisdiction codes | 55/55 | Free text cannot reliably support country, region, institution, or multi-country filtering. |
| Structured eligibility rules | 55/55 | Nationality, residency, degree, discipline, experience, age, language, admission, and exclusions cannot be queried independently. |
| Structured funding components | 55/55 | Amount, currency, minimum/maximum, cadence, tuition percentage, duration, and non-cash benefits are inseparable prose. |
| Host institution/programme and subject taxonomy | 55/55 | Programme-specific awards cannot be related to eligible programmes, disciplines, or institutions. |
| Contact details and official application guidance | 55/55 | Users cannot distinguish general information from the operative call or contact. |
| Catalogue audit metadata | 55/55 | There is no created/updated timestamp, reviewer, revision history, or supersession link. |

## Deadline categories

The four categories account for all 55 records.

| Category | Records | Share | Stored-date shape | Legacy IDs | Meaning evidenced by the data |
| --- | ---: | ---: | --- | --- | --- |
| `exact` | **24** | **43.6%** | 20 records have one date; 4 have two; **28 values** total | 3, 4, 5, 7, 11, 12, 13, 14, 15, 16, 17, 20, 25, 26, 28, 29, 30, 31, 32, 34, 41, 42, 43, 54 | `deadlineText` names a day; four annual schemes encode two rounds. “Exact” is a guide assertion, not a recorded verification state. |
| `estimated` | **20** | **36.4%** | Every record has exactly one proxy date; **20 values** total | 1, 8, 9, 10, 21, 22, 23, 33, 35, 36, 37, 38, 39, 40, 44, 46, 47, 51, 52, 55 | Broad, typical, early, “for most,” variable, or month-range text is reduced to one calendar date. |
| `rolling` | **5** | **9.1%** | All five arrays are empty | 2, 6, 27, 45, 53 | The text says rolling, apply anytime, or rolling/program-specific. One record also says “annual call,” which the model cannot represent alongside rolling. |
| `unknown` | **6** | **10.9%** | All six arrays are empty | 18, 19, 24, 48, 49, 50 | The date varies by institution, country, consortium, programme, or annual call and no proxy date is stored. |

The prototype treats `rolling` as ongoing regardless of dates. Any other record with no dates becomes “Verification required.” For dated records it selects the first date on or after today, or the final stored date if all have passed. It adds an “Estimated from guide” label for `estimated`. This consumer behaviour is useful evidence of legacy intent, but it is not a sufficient production deadline model.

### Deadline freshness at this checkpoint

All 48 stored dates are in 2026. As of **2026-07-12**:

| Precision | Dated records | All stored dates already passed | At least one date remains |
| --- | ---: | ---: | ---: |
| `exact` | 24 | 15 | 9 |
| `estimated` | 20 | 15 | 5 |
| **Total** | **44** | **30** | **14** |

Four exact records (IDs 3, 4, 5, and 31) have both a past and a future 2026 round. In total, 34 records have at least one past stored date. The dataset has no recurrence rule to produce a later cycle, so all date values will become stale without a verified refresh.

### Lossy or ambiguous deadline examples

- Fifteen of the 20 estimated records express an en-dash month/date range in `deadlineText`, but each stores only one date, normally the range end.
- IDs 40 and 55 say only “February” but store `2026-02-28`; ID 21 says “early January” but stores `2026-01-10`. The conversion rule and evidence are not recorded.
- ID 33 says “End of October/November; varies by country” but stores one date, `2026-11-30`.
- ID 21 identifies an **institutional** deadline, but there is no deadline-type field to prevent it being presented as an applicant deadline.
- IDs 2 and 53 combine rolling and programme-specific semantics. ID 45 combines rolling and annual-call semantics. IDs 49 and 50 mention annual calls but contain neither a cycle nor a recurrence rule.
- The four two-date records do not identify the intake, audience, round, or source that belongs to each date.

## Format inconsistencies and normalization needs

### Location

`country` contains 19 distinct strings but does not consistently represent a country:

- **46** records use a single-country label.
- **3** use slash composites: `Spain / Portugal` (ID 40), `Austria / Hungary` (ID 52), and `Germany / EU` (ID 53).
- **6** use `EU-wide` (IDs 47–51 and 55).

These values cannot cleanly support country codes, multiple host locations, nationality eligibility, and funding jurisdiction as separate concepts.

### Academic level and audience

The arrays are non-empty and use six consistent spellings, but the vocabulary mixes degree levels with opportunity modes or career stages.

| Value | Records |
| --- | ---: |
| `Bachelor` | 11 |
| `Master` | 45 |
| `PhD` | 23 |
| `Postdoc` | 3 |
| `Research` | 9 |
| `Exchange` | 2 |

Twenty-seven records have one level value, 18 have two, and 10 have three. Counts above overlap because records can have multiple values. `Research` and `Exchange` should not be treated as degree levels, and `Postdoc` is better represented as a career stage/audience.

### Funding/benefit text

- **38** benefits contain at least one digit; **17** have no numeric amount.
- Currency notation mixes the `€` symbol (**27 records**) with currency codes `SEK` (1), `DKK` (2), `CHF` (3), `CZK` (1), and `PLN` (1).
- Cadence uses both slash and prose forms: `/month` appears in 19 records while `per month` appears in 1; `/year` appears in 1 while `per year` appears in 6. Other records use per-semester, one-time, project-based, or no cadence.
- Values mix exact amounts, ranges, percentages, “up to,” “partial,” “full,” fee waivers, salaries, allowances, insurance, travel, housing, and research budgets in one string.
- IDs 18, 20, and 35 explicitly qualify benefit claims with “the guide states” or “as stated in the guide,” highlighting the absence of direct fact provenance.

Amounts must not be parsed into production facts without checking the official source, currency, period, coverage, duration, conditions, and relevant application cycle.

### Eligibility text

All eligibility values are populated, but all are unstructured prose. The same field carries combinations of nationality/residency, EEA status, degree, discipline, work experience, merit, age, institutional admission, nomination, mobility rules, and civic engagement. “International,” “developing countries,” “eligible countries,” and similar phrases do not identify an actual country set or the cycle in which it applies.

### Opportunity identity and type

The catalogue mixes materially different things under “scholarship”: for example, a public-university tuition policy (ID 8), individual scholarships, doctoral fellowships/jobs, mobility support, a doctoral network (ID 48), an investigator grant (ID 49), and project calls (ID 50). Sequential IDs and display names cannot safely deduplicate or track these schemes across renames, providers, programmes, and yearly calls.

### Sources

Every record has exactly one unique HTTPS URL, but URLs vary in granularity from a specific scheme page to broad scholarship, admissions, doctoral, or funding pages. The dataset has no source type, official-source assertion, field-to-source mapping, verification result, checker, check date, or historical URL. URL reachability and content were not tested in this inventory.

### Text encoding

The source is UTF-8 and includes characters such as `€`, en dashes, accented names, and `Skłodowska-Curie`. Any import pipeline must explicitly preserve UTF-8; readers that assume a legacy Windows encoding can corrupt titles and financial text.

## Data-quality risks

1. **Unverified facts:** none of the 55 records carries verification status or a last-checked date, so the production requirement for official, checked opportunity facts is unmet.
2. **Guide-derived claims:** `README.txt` says the information is based on a supplied guide and instructs users to verify official websites. The guide itself is not represented as provenance in each record.
3. **Stale cycle data:** every concrete date is hard-coded to 2026, 30 of 44 dated records are already fully past at the audit date, and there is no recurrence or refresh history.
4. **Estimated dates can look exact:** all 20 estimated records store a precise calendar day even when the source text gives a window or variable/program-specific timing.
5. **Unknown and rolling nuance is compressed:** annual, continuously open, periodically reviewed, and programme-specific calls cannot be represented independently.
6. **Mixed catalogue scope:** degree scholarships, tuition policies, fellowships, jobs/networks, mobility awards, and large research/project grants need different fields and user expectations.
7. **One source cannot prove all facts:** benefits, eligibility, deadline, and application route may come from different official pages or cycle documents.
8. **Free-text facts are not safely queryable:** automated extraction of money, countries, eligibility, or dates would introduce silent interpretation errors.
9. **Fragile identity:** the unique 1–55 IDs, names, and URLs are useful within this snapshot but do not establish stable cross-cycle or provider identities.
10. **No history or supersession:** changes, closures, renamed schemes, and corrected facts cannot be audited.

## Migration risks and controls

| Risk | Required control before any production import |
| --- | --- |
| Treating the legacy array as authoritative | Mark every candidate record unverified and verify against an official source before publication. |
| Carrying proxy dates as confirmed deadlines | Preserve the original text, model estimated windows explicitly, and publish a specific date only with supporting official evidence. |
| Reusing `id` as a production primary key | Generate stable production IDs; retain `legacyId` only as traceability metadata. |
| Flattening yearly calls into one opportunity | Separate the durable opportunity from application cycles and their deadlines. |
| Parsing benefits or eligibility automatically | Use a reviewed, field-by-field mapping with the original prose retained for comparison. |
| Treating `country` as one normalized country | Map to explicit jurisdictions/locations through a many-to-many relationship. |
| Treating all `levels` as degree levels | Split degree level, career stage, exchange mode, and research audience. |
| Assuming `url` is current and official | Resolve the page, confirm ownership and scheme relevance, store source type, and record the check date/result. |
| Overwriting changed facts | Keep source-check and revision history so corrections are attributable and reversible. |
| Mixing catalogue and personal tracking data | Keep verified opportunity facts separate from guest/account shortlist, notes, checklist, and application-state records. |

## Recommended future entities

| Entity | Responsibility |
| --- | --- |
| `Opportunity` | Durable scheme identity, title, typed opportunity category, summary, provider, and lifecycle state. |
| `Organisation` | Provider, funder, host, embassy, university, consortium, or administering body, with stable names and official domains. |
| `ApplicationCycle` | Intake/call/academic-year instance of an opportunity, including open/closed status and cycle-specific application route. |
| `Deadline` | Typed opening/closing/nomination/review date or window, timezone, precision, recurrence/rolling semantics, and cycle relationship. |
| `OfficialSource` | Canonical URL, owning organisation, source type, locale, and the opportunity/cycle it supports. |
| `SourceCheck` | Verification status, last-checked time, checker, result, fields checked, and correction/supersession notes. |
| `Jurisdiction` and `OpportunityJurisdiction` | Normalized country/region/supranational coverage with relationship type such as host, funding, or availability. |
| `AcademicLevel` and `OpportunityLevel` | Controlled degree-level taxonomy and many-to-many mapping. |
| `Audience` | Career stage and participation modes such as postdoctoral, researcher, or exchange, kept separate from degree level. |
| `EligibilityRule` | Reviewed rules for nationality/residency, prior degree, discipline, experience, age, language, admission, mobility, and exclusions. |
| `FundingPackage` and `FundingComponent` | Currency, amount/range, cadence, duration, tuition coverage, stipend, travel, insurance, housing, and other benefits. |
| `Programme` / `HostInstitution` | Programme-specific applicability and relationships that should not be embedded in the opportunity title. |
| `ApplicationRoute` | Official information URL, direct application URL, nomination/embassy/consortium path, and applicant instructions. |
| `Tag` / `Discipline` | Reviewed search facets that do not overload eligibility prose. |
| `UserOpportunity` and related tracking records | Shortlist, status, notes, checklist, priority, and user-confirmed deadlines, separate from catalogue facts and able to support guest-local data first and optional synchronization later. |

Names above are conceptual, not a committed database schema. The model should remain small enough for the first-year scope while preserving source verification and deadline history as non-negotiable catalogue concerns.

## Migration boundary for checkpoint 0

- Do **not** seed these 55 records into a production database yet.
- Do **not** reinterpret an estimated proxy as an exact deadline.
- Do **not** label a fact verified merely because a URL is present.
- Preserve the original record and `legacyId` for audit traceability when a future reviewed migration begins.
- Verify each opportunity's existence, scope, official source, current cycle, deadline, eligibility, and benefits before publication.
- Record verification status and last-checked dates at the same time as any future imported facts.
