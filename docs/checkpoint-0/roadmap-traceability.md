# Roadmap traceability

## Purpose

This matrix traces every V1 backlog item to a Checkpoint 1-7 roadmap deliverable and validation outcome. `Planned` means specified but not implemented in Checkpoint 0. `Explicitly deferred` means intentionally excluded from Year 1 with a documented reason in the backlog and ADRs.

## Checkpoint 1: Public PWA Alpha

| Roadmap checkpoint | Roadmap deliverable | Backlog ID | Planned implementation stage | Expected validation | Current status |
| --- | --- | --- | --- | --- | --- |
| Checkpoint 1 | Publication-gated catalogue | `C1-01` | Alpha catalogue slice | Publication fixtures, privacy boundary, accessibility | Planned |
| Checkpoint 1 | Source-aware details | `C1-02` | Alpha detail routes | Source fail-closed, safe links, route/a11y tests | Planned |
| Checkpoint 1 | Deadline presentation | `C1-03` | Shared deadline view model | Formal scenario suite and no-rollover audit | Planned |
| Checkpoint 1 | Discovery and filters | `C1-04` | Catalogue navigation | Filter contracts, URL state, keyboard tests | Planned |
| Checkpoint 1 | Guest local workspace | `C1-05` | Versioned client persistence | Corruption, quota, export/import, reset tests | Planned |
| Checkpoint 1 | Responsive installable PWA | `C1-06` | Alpha hardening | Manifest, offline/update, responsive/a11y audits | Planned |

## Checkpoint 2: Verified Database and Admin System

| Roadmap checkpoint | Roadmap deliverable | Backlog ID | Planned implementation stage | Expected validation | Current status |
| --- | --- | --- | --- | --- | --- |
| Checkpoint 2 | Relational catalogue | `C2-01` | Database foundation | Migration, constraints, backup/restore, least privilege | Planned |
| Checkpoint 2 | Source verification | `C2-02` | Editorial evidence workflow | State, evidence, conflict, history tests | Planned |
| Checkpoint 2 | Staff review workspace | `C2-03` | Admin review workflow | Role matrix and self-approval denial | Planned |
| Checkpoint 2 | Taxonomy/provider administration | `C2-04` | Admin taxonomy tools | Uniqueness, merge/archive, impact tests | Planned |
| Checkpoint 2 | Correction/assignment queues | `C2-05` | Editorial operations | Submission, assignment, abuse, privacy tests | Planned |
| Checkpoint 2 | Catalogue audit history | `C2-06` | Cross-cutting operations | Immutability, redaction, retention, access tests | Planned |

## Checkpoint 3: Personal Workspace and Cloud Sync

| Roadmap checkpoint | Roadmap deliverable | Backlog ID | Planned implementation stage | Expected validation | Current status |
| --- | --- | --- | --- | --- | --- |
| Checkpoint 3 | Optional accounts | `C3-01` | Account foundation | Sessions, recovery, deletion, access tests | Planned |
| Checkpoint 3 | Confirmed guest migration | `C3-02` | Account onboarding | Preview, consent, conflict, retry tests | Planned |
| Checkpoint 3 | Student profile/experience | `C3-03` | Private profile workspace | CRUD, export/delete, authorisation tests | Planned |
| Checkpoint 3 | Cloud shortlist/tracker | `C3-04` | Synced application workspace | Ownership, history, offline conflict tests | Planned |
| Checkpoint 3 | Metadata-only document register | `C3-05` | Reusable readiness metadata | File-field prohibition and ownership tests | Planned |
| Checkpoint 3 | Export/permanent deletion | `C3-06` | Privacy control centre | Scope, cascade, backup expiry, audit tests | Planned |
| Checkpoint 3 | Sensitive document uploads | `C3-07` | Beyond-Year-1 boundary | Validator proves no active file capability | Explicitly deferred: prohibited in Year 1 |

## Checkpoint 4: Discovery, Eligibility and Notifications

| Roadmap checkpoint | Roadmap deliverable | Backlog ID | Planned implementation stage | Expected validation | Current status |
| --- | --- | --- | --- | --- | --- |
| Checkpoint 4 | Deterministic eligibility | `C4-01` | Rule engine | Truth tables, boundaries, missing/conflict tests | Planned |
| Checkpoint 4 | Consent-based matching | `C4-02` | Personal discovery | Consent, field selection, deletion tests | Planned |
| Checkpoint 4 | Explainable ranking | `C4-03` | Discovery ranking | Determinism, attribution, fairness review | Planned |
| Checkpoint 4 | Saved searches/updates | `C4-04` | Discovery retention | Ownership, query version, update tests | Planned |
| Checkpoint 4 | In-app reminders | `C4-05` | Personal notification scheduler | Timezone, DST, stale-source, ownership tests | Planned |
| Checkpoint 4 | Free-tier external adapter | `C4-06` | Optional delivery integration | Quota, outage, fallback, unsubscribe tests | Planned, conditional on review |
| Checkpoint 4 | Paid SMS/WhatsApp dependency | `C4-07` | Beyond-Year-1 boundary | Core workflow dependency scan | Explicitly deferred: cost constraint |

## Checkpoint 5: Source-Grounded AI Assistant

| Roadmap checkpoint | Roadmap deliverable | Backlog ID | Planned implementation stage | Expected validation | Current status |
| --- | --- | --- | --- | --- | --- |
| Checkpoint 5 | Source-grounded assistant | `C5-01` | AI read assistant | Citation, refusal, stale-source, adversarial tests | Planned |
| Checkpoint 5 | Eligibility explanation | `C5-02` | Deterministic-result explainer | Outcome preservation and privacy tests | Planned |
| Checkpoint 5 | Human-reviewed extraction | `C5-03` | Reviewer suggestion workflow | Evidence alignment and approval separation | Planned |
| Checkpoint 5 | AI records/quotas | `C5-04` | AI operations | Concurrency, reset, redaction, cost tests | Planned |
| Checkpoint 5 | AI evaluation gate | `C5-05` | Release safety gate | Versioned evaluation and kill-switch drill | Planned |
| Checkpoint 5 | Autonomous decisions | `C5-06` | Beyond-Year-1 boundary | Permission/adversarial absence tests | Explicitly deferred: governance constraint |

## Checkpoint 6: Production Hardening, SEO and Advertising

| Roadmap checkpoint | Roadmap deliverable | Backlog ID | Planned implementation stage | Expected validation | Current status |
| --- | --- | --- | --- | --- | --- |
| Checkpoint 6 | Security/privacy hardening | `C6-01` | Pre-production gate | Threat, authz, scan, secret, incident tests | Planned |
| Checkpoint 6 | Performance/PWA resilience | `C6-02` | Production optimization | Load, Web Vitals, offline/cache/rollback tests | Planned |
| Checkpoint 6 | SEO discoverability | `C6-03` | Public indexing | Metadata, sitemap, robots, private-index tests | Planned |
| Checkpoint 6 | Privacy-conscious observability | `C6-04` | Production operations | Redaction, retention, alerts, access tests | Planned |
| Checkpoint 6 | Controlled advertisements | `C6-05` | Optional commercial slice | Disclosure, independence, a11y, privacy tests | Planned, conditional on approval |
| Checkpoint 6 | Sponsored disclosures | `C6-06` | Optional commercial slice | Completeness, expiry, audit, ranking tests | Planned, conditional on approval |
| Checkpoint 6 | Native applications | `C6-07` | Beyond-Year-1 boundary | PWA limitation review | Explicitly deferred: PWA-first decision |

## Checkpoint 7: Commercial Public Launch

| Roadmap checkpoint | Roadmap deliverable | Backlog ID | Planned implementation stage | Expected validation | Current status |
| --- | --- | --- | --- | --- | --- |
| Checkpoint 7 | Launch data-quality gate | `C7-01` | Launch approval | Full catalogue/source/public-payload audit | Planned |
| Checkpoint 7 | Privacy/control centre | `C7-02` | Launch compliance experience | Consent, export/delete, version/a11y tests | Planned |
| Checkpoint 7 | Support/correction operations | `C7-03` | Launch operations | Escalation and emergency-unpublish drill | Planned |
| Checkpoint 7 | Privacy-minimised analytics | `C7-04` | Launch measurement | Event allowlist, retention, opt-out tests | Planned |
| Checkpoint 7 | Commercial/cost gate | `C7-05` | Launch finance review | Spend limits, outage, fallback exercises | Planned |
| Checkpoint 7 | Release/rollback readiness | `C7-06` | Launch engineering gate | Promotion, failed migration, restore/incident drill | Planned |
| Checkpoint 7 | Autonomous submissions | `C7-07` | Beyond-Year-1 boundary | Route/integration/action absence tests | Explicitly deferred: user-control constraint |

## Coverage confirmation

Every roadmap requirement for Checkpoints 1 through 7 appears above and maps to a valid backlog ID. All 46 backlog IDs are represented exactly once. Five prohibited or out-of-scope capabilities are explicitly deferred with reasons: sensitive file uploads, paid SMS/WhatsApp dependency, autonomous AI decisions, native applications, and autonomous application submission. Conditional `Could` items remain subject to privacy, accessibility, cost, and commercial approval; their presence is not implementation authorisation.
