# Checkpoint 0: Data ownership, retention, export, and deletion

## Purpose and terminology

This policy describes who controls each major ScholarTrack data category and
what must happen through its lifecycle. It is an architecture target, not a
claim that a production database, account system, or deletion service exists.

In this document, **owner** means the person or product steward with the primary
interest in and authority over the record; it does not decide copyright or legal
title. **Controller** means the party deciding why and how hosted data is
processed. The planned ScholarTrack operating entity is called **ScholarTrack
operator** until its legal identity and controller/processor roles are confirmed
by legal review. An official provider remains authoritative for its opportunity
facts and retains rights in its source material.

Retention statements below are policy targets tied to lifecycle events. They do
not invent statutory requirements or promise arbitrary calendar periods. Before
the relevant production capability is enabled, each target must become an
enforceable schedule with a documented maximum, recovery/backup treatment,
security rationale, and jurisdictional legal review.

## Complete category register

| Data category | Owner or primary steward | Controller | Who can read | Who can modify | Who can delete | Retention expectation / policy target | Deletion behaviour | Anonymisation or pseudonymisation | Audit-log consequences | Export eligibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guest local data | Guest using the browser/device | Guest; ScholarTrack operator is not controller until data is intentionally transmitted | Guest through that local browser profile; no staff or cloud service | Guest; application code only on the guest's device and at the guest's action | Guest | Keep locally until the guest deletes it, browser storage is cleared, the device/profile is lost, or the guest confirms migration and then separately confirms local removal | Clear selected or all local records immediately when requested; account creation alone must not delete, upload, or migrate them | Not required for local-only records; generated record IDs must not become cross-site tracking IDs | No server audit event because no server copy exists; a local, non-sensitive migration receipt may be shown/exported | Yes, local machine-readable export without an account |
| Registered student data | Student/data subject | ScholarTrack operator for hosted processing, subject to pre-launch legal confirmation | Student; a narrowly scoped System Service; staff only through Exceptional + Audited access | Student for own records; scoped services for sync, export, deletion, and deterministic processing; no routine staff editing | Student through self-service or verified request; scoped deletion service | Keep while the optional account is active and the feature is requested; minimise inactive data and apply a pre-launch inactivity policy rather than indefinite default retention | Revoke sessions and scheduled processing, remove live private records, mark backups against restoration, and age content out by the documented backup maximum; confirm completion without retaining content | Replace unavoidable security/audit links with a non-reversible or pseudonymous reference where feasible; do not anonymise merely to continue unrelated profiling | Record request, authentication assurance, scope, start/outcome, and service actor without copying deleted content; the minimal audit event may remain under its own schedule | Yes, student's profile, preferences, shortlist, tracker, notes, tasks, reminders, document metadata, notification data, and student-visible AI history in a documented machine-readable package |
| Public opportunity data | ScholarTrack is steward of its structured catalogue; official provider is authoritative for facts and source rights | ScholarTrack operator for the catalogue | Everyone once published; staff can read drafts under assignment | Assigned Reviewer may edit own/assigned draft; Senior Reviewer may approve/publish within scope; Administrator only exceptionally; scoped service may normalise a draft but never approve it | Senior Reviewer may archive; exceptional Administrator may remove content for a documented rights, safety, or legal reason | Keep while current; supersede rather than silently overwrite; retain sufficient version/source provenance to explain published facts | Normal removal is archive/unpublish, not hard deletion. Correct factual errors by a traceable revision. Hard deletion is exceptional when source rights, safety, or legal review requires it | Normally not personal. Remove or redact accidentally included personal data and third-party identifiers not necessary for provenance | Approval, publication, correction, archive, restoration, and exceptional deletion remain audited with actor, revision, evidence, reason, and outcome | Yes for public structured facts and provenance where source/licensing terms permit; no internal notes or restricted evidence |
| Archived opportunity data | ScholarTrack catalogue steward; official provider remains authoritative for source facts | ScholarTrack operator | Public when a historical record can be shown accurately and lawfully; otherwise assigned staff only | Senior Reviewer through a new revision or restoration workflow; ordinary archived versions are immutable | Exceptional Administrator after documented review; a Senior Reviewer archives but does not hard-delete | Keep as historical provenance while it supports correction, cycle history, and audit needs; conduct periodic necessity and source-rights review | Preserve the original cycle and archive reason. Restore by a new audited state transition; do not rewrite an old deadline into a future cycle. Hard-delete only the content specifically requiring removal | Redact unnecessary personal names/contact details while preserving non-personal source and decision provenance | Archive, restore, redaction, and hard deletion events remain; a deleted target may be referenced by opaque ID and content hash, not retained content | Public historical export only where publication and source rights permit; staff export is scoped and excludes restricted material |
| Correction reports | Reporter for their contact/private submission; ScholarTrack is steward of triage and disposition | ScholarTrack operator once submitted; guest-local draft stays under the guest's control | Reporter for their own report/status where supported; assigned Reviewer/Senior Reviewer; exceptional Administrator; no public access by default | Reporter may edit an unsubmitted local draft or add requested clarification; assigned staff may classify, respond, link evidence, and resolve without rewriting the original submission | Reporter may request deletion of their personal data; assigned staff may remove spam/abuse content; disposition evidence follows its independent retention need | Keep through triage, resolution, and a bounded quality/dispute-review window; configure the maximum before collection and remove reporter identity sooner when no longer needed | Delete reporter contact and unnecessary free text on request or when no longer needed; preserve only a minimised, anonymised correction outcome if required to explain a catalogue revision | Remove direct reporter identity and scrub unnecessary personal details; use an opaque report ID for retained quality statistics | Submission, assignment, disposition, catalogue change, and identity deletion are audited; audit content must not reproduce the full report or contact details | Yes, reporter's submitted content, status, responses, and linked public outcome; exclude staff-only deliberation, other users, and security signals |
| Reviewer work | ScholarTrack catalogue/review steward; reviewer is data subject for attribution and account data | ScholarTrack operator | Author, assigned review team, Senior Reviewer, and scoped audit administrators; public sees only approved verification/provenance summaries | Author may edit own draft; assigned reviewer may add review; Senior Reviewer may decide within separation-of-duties rules; no one rewrites another actor's signed decision | Reviewer may delete an unsubmitted personal draft if it has no dependent workflow; Senior Reviewer/Administrator may remove inappropriate notes under audit; accepted decisions are not ordinary user-deletable | Keep signed evidence and decisions with the relevant opportunity revision; expire scratch notes and rejected duplicates under a shorter configured operational schedule | Delete or redact transitory notes when no longer needed. Preserve necessary decision facts as immutable provenance; corrections append or supersede rather than erase history | On staff departure, disable identity and replace display details where appropriate while retaining a stable pseudonymous actor reference needed for accountability; legal review determines attribution obligations | Authorship, assignment, review, approval, conflict, publication, redaction, and deletion remain append-only audit events | Limited: reviewer may obtain their personal/account data and attributable actions, but not third-party personal data, secrets, restricted reports, or source material without export rights |
| Audit logs | ScholarTrack security and accountability steward; referenced people remain data subjects | ScholarTrack operator | Assigned audit/security administrators; Senior Reviewer only for assigned editorial audit subset; no general student or service browsing | Append-only System Service; no role may edit an existing event; authorised retention service may add expiry/deletion markers | Only a narrowly scoped retention/deletion service under approved policy; no ad hoc deletion by the actor recorded | Keep for the shortest fixed period that supports security, abuse response, review accountability, and verified deletion evidence; set and test the maximum before accounts/staff production use | Automatically expire by category. Do not erase an event merely to conceal an action; when a data-subject request applies, remove or pseudonymise links/content unless a reviewed security/legal need requires the minimum event | Use opaque target/actor IDs and pseudonymise links after account deletion where feasible; never log secrets, prohibited files, full notes, or full AI prompts | Log access, export, retention-policy change, legal hold if ever authorised, pseudonymisation, and deletion must themselves create protected audit events without recursively copying content | A student may receive the safe subset materially about their account where required or product-supported; security details, other actors' personal data, and exploit-enabling fields are excluded after review |
| AI interaction records | Student for their prompt/response history; ScholarTrack steward for minimal quota/safety metadata | ScholarTrack operator and any declared AI processor, whose terms require review before use | Student; response-generation service; staff only Exceptional + Audited for a specific incident; aggregate quota viewers cannot read content | Student may delete or label own history; service may append response/status and redaction metadata; staff must not silently edit content | Student; automated expiry service; exceptional safety deletion with reason | Default target is no content retention beyond generating the response unless the student deliberately saves history; any diagnostic retention must be opt-in or strictly necessary, short, documented, and configured before AI launch | Erase prompt, response, embeddings/cache, and provider-side retained copies where supported; retain only non-content quota/accounting facts or anonymised safety aggregates that remain necessary | Strip direct identifiers before provider calls where possible; aggregate usage independently of prompt content; do not treat reversible hashing as anonymisation | Record provider call metadata, model/version, source set, quota effect, deletion, and exceptional content access without copying prompt/response bodies into the audit log | Yes for the student's saved prompt/response history, cited public sources, and usage summary; exclude model secrets, safety internals, other users, and provider credentials |
| Analytics events | No proprietary claim over a person's behaviour; ScholarTrack is steward of aggregate product measurements | ScholarTrack operator and only a disclosed analytics processor, if used | Assigned staff see aggregate/de-identified reports; narrowly scoped service may process raw limited-ID events | Event service appends; analytics pipeline validates/aggregates; staff cannot alter raw history to change results | Automated retention service; privacy administrator for verified deletion of linkable events | Prefer immediate aggregation. Raw events must have a short automatic maximum chosen before collection; keep non-identifying aggregates only while they remain useful and reviewed | Delete raw events at expiry and on verified account deletion when linkable; do not recreate identity links from aggregates | Avoid persistent identifiers. Use scoped rotating/pseudonymous IDs only when essential; remove IP/user-agent detail or coarsen it promptly; never include sensitive profile or content fields | Audit schema/consent/processor/retention changes and privileged raw-data access; do not audit every anonymous page event twice | Identifiable or pseudonymous events linked to a student are eligible where technically attributable; truly anonymous aggregates are not an individual export and must not be re-identified |
| Advertising events | No ownership claim over a person's behaviour; ScholarTrack is steward of placement, impression, click, and disclosure records | ScholarTrack operator; any future advertising processor/controller role requires contract and legal review | Assigned Administrator sees campaign and aggregate placement results; scoped delivery/fraud service processes minimal events; advertisers receive only contractually approved aggregates | Assigned Administrator configures controlled placements; service appends delivery events; advertisers cannot modify ScholarTrack user records | Automated retention service; privacy administrator for linkable deletion; Administrator may end a placement but not erase accountability | Keep raw events only through a short configured reconciliation/fraud window, then retain non-identifying aggregate totals and required sponsorship disclosures under a reviewed schedule | Delete linkable raw events at expiry or verified student deletion; ending a placement stops collection. Never transfer a student profile, shortlist, eligibility, progress, notes, documents, or prompts | Use contextual placement and aggregate measurement; no cross-site ID or sensitive targeting. Rotate/pseudonymise any essential fraud token and remove the account link promptly | Placement creation/change, sponsor disclosure, privileged event access, export, and deletion are audited; ordinary impressions need not contain a user identity | Linkable events are included in the student's export where attributable; aggregate commercial reports and fraud/security logic are not personal exports |

## Ownership and access invariants

- Role permission does not replace resource ownership or assignment checks. A
  staff title alone never grants student-data access.
- Student private data cannot be transferred to an opportunity provider,
  advertiser, reviewer, or another student. It cannot be sold.
- A System Service is not an owner. It processes only assigned fields for one
  named purpose and cannot turn operational access into human browsing.
- Official opportunity data is corrected through versioned evidence and human
  approval. Historical deadline cycles remain historical; deletion must not be
  used to manufacture a current cycle.
- No deletion workflow authorizes hiding staff misconduct, a security event, or
  a publication decision. Any retained audit evidence must nevertheless be
  minimised and pseudonymised where accountability permits.
- Prohibited Year 1 passport, transcript, certificate, bank-statement, and
  financial-document files have no ownership/retention workflow because the
  platform must never receive them. Only permitted readiness metadata follows
  the registered-student-data row.

## Guest-to-account migration ownership

Guest data remains controlled by the Guest until a confirmed migration. The
migration screen must name categories and counts, allow selective inclusion,
identify the destination account, and require affirmative confirmation.
Server-side writes must be idempotent and verified before success is declared.
The local copy remains the Guest's data after migration until the user separately
chooses to delete it; an account sign-in, sync toggle, or successful copy must
not silently clear it.

If migration fails, no partial record may be presented as complete. The system
must report the recoverable state without logging note bodies or sensitive
metadata, and a retry must not duplicate records.

## Registered-account deletion sequence

When hosted accounts are introduced, permanent deletion must follow this
minimum sequence:

1. authenticate the requester and show the categories, consequences, local-data
   distinction, and any narrowly reviewed exception;
2. obtain explicit confirmation without coercing the student to keep an account;
3. revoke sessions, tokens, reminders, notifications, AI work, exports, and
   scheduled processing associated with the account;
4. delete live private and sensitive records and send deletion instructions to
   declared processors;
5. place a non-content deletion marker in backup/recovery controls so restoration
   cannot silently resurrect the account;
6. pseudonymise minimal audit/security references that must remain, and delete
   all other direct identifiers;
7. provide a completion receipt that contains no deleted content.

Account deletion must not delete browser-local guest data on a different device
or profile. The interface must explain and separately offer local deletion.

## Retention schedule launch gate

Before any hosted category is collected, its owner must approve a schedule that
states the triggering event, live-data maximum, backup maximum, processor
propagation, automatic deletion job, exception authority, audit treatment, and
test evidence. Security and legal reviewers must resolve applicable
jurisdictions, age rules, statutory exceptions, source/licensing duties, and
data-subject response periods. Until then, collection for accounts, raw
analytics, AI content history, or advertising events remains disabled; this
document does not substitute an invented legal deadline.

## Verification and testing requirements

- Test local guest export, selective migration, retry idempotency, and local
  deletion without an account.
- Test full and category-level student export for completeness, isolation, and
  absence of secrets, other users, and restricted staff data.
- Test live deletion, session revocation, scheduled-job cancellation, processor
  propagation, backup deletion markers, and non-restoration after recovery.
- Test expiry jobs for correction identities, scratch reviewer notes, audit
  categories, AI content, raw analytics, and advertising events using the
  approved schedules.
- Test that anonymised aggregates cannot be joined back to account, device,
  shortlist, eligibility, or application-progress identifiers.
- Test that every exceptional read, export, redaction, and deletion produces the
  required minimal audit event and that logs contain no prohibited or secret
  material.
