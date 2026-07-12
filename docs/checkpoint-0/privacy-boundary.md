# Checkpoint 0: Privacy boundary and data classification

## Purpose and governing principles

This document sets ScholarTrack's Year 1 privacy boundary. It is a product and
engineering policy, not a claim of compliance with any particular law. The
applicable jurisdictions, controller/processor wording, age requirements,
consent language, response deadlines, and final retention periods require legal
review before public launch.

ScholarTrack must minimise collection, keep guest mode usable without an
account, use private information only for a clear student-requested function,
and apply the most protective applicable classification when a record combines
data classes. Authorization remains deny by default and least-privileged. The
platform must not sell student data or exchange it for advertising access.

The six classification names below are canonical.

### 1. Public

Information deliberately approved for unrestricted viewing, such as a
published opportunity fact and its public provenance. Public does not mean
unverified or free of source rights: publication still requires an official
source, verification status, last-checked date, and any necessary attribution.
Drafts and unpublished review details are not Public.

### 2. Internal

Non-public business and editorial information whose disclosure is not expected
to harm a student directly, including draft catalogue content, workflow state,
aggregate operational plans, and de-identified analytics summaries. It is
available only to assigned staff and services. A record containing private or
security-relevant material moves to the stricter class.

### 3. Private user data

Student-created or student-linked workspace information needed to provide a
personal feature, including shortlists, notes, progress, reminders, and
notifications. It is readable by the student and only the narrowly scoped
services required to provide that feature. Staff access is exceptional,
purpose-bound, time-bound, and audited. Private user data must be exportable and
permanently deletable, subject only to narrow disclosed exceptions that pass
legal review.

### 4. Sensitive personal metadata

Structured personal facts that can expose identity, location, academic profile,
career history, eligibility, or third-party contact information. This class
requires field-level minimisation, encryption in transit and at rest when
server-side storage is introduced, explicit purpose, strict access, and no use
for advertising. Metadata status does not authorize storing an underlying
document file.

### 5. Restricted operational data

Security, abuse-prevention, access-control, and operational evidence whose
disclosure could compromise users or the platform. Examples include password
hashes, server-side API keys, narrowly retained security logs, raw limited-ID
analytics events, and exceptional-access records. Access is job-scoped and
audited. Secrets must remain server-side and must never enter a client bundle,
browser storage, source control, analytics event, AI prompt, or application log.

### 6. Prohibited Year 1 data

Data the Year 1 core product must not collect, upload, import, transmit to an AI
provider, or store: passport files or images, transcript files or images,
certificate files or images, bank statements, and other financial-document
files or images. Extracted text, OCR output, file blobs, platform-accessible
external links, and replicas or thumbnails of those files are prohibited too.
This prohibition applies even if a student asks to upload the material.

## Classification register

The table classifies every data item in the Checkpoint 0 scope. Where a single
concept has public and internal representations, each representation is stated
explicitly rather than weakening the stricter record.

| Data item | Classification | Boundary and permitted representation |
| --- | --- | --- |
| Opportunity records | Public after approval; Internal while draft | Only approved facts are public. Drafts, conflicts, assignments, and unpublished revisions remain Internal. |
| Official sources | Public | Publish the official URL and supported-fact provenance when rights allow. Credentials, private correspondence, and internal capture notes are not part of the Public source record. |
| Verification history | Public summary; Internal workflow history | Source, current verification status, and last-checked date are Public with the fact. Staff deliberation, superseded drafts, and assignment history are Internal; security-relevant events are Restricted operational data. |
| Reviewer notes | Internal | Keep notes factual and opportunity-focused. If a note exceptionally includes student data, classify the entire note as Sensitive personal metadata and apply audited exceptional access. |
| Nationality | Sensitive personal metadata | Collect only when needed for a student-requested eligibility check or preference; never infer it or use it for advertising. |
| Residence | Sensitive personal metadata | Store only the granularity required by an official eligibility rule. |
| Province and domicile | Sensitive personal metadata | Keep province and legal-domicile concepts distinct and collect only when an official rule needs them. |
| CGPA | Sensitive personal metadata | Store the supplied value with scale/context; do not request a transcript file to prove it in Year 1. |
| Graduation date | Sensitive personal metadata | Keep actual and expected graduation semantics distinct; use only for relevant eligibility and planning. |
| Work experience | Sensitive personal metadata | Store structured, minimised facts supplied by the student; no evidence-file upload. |
| Research experience | Sensitive personal metadata | Store structured, minimised facts supplied by the student; no evidence-file upload. |
| Publications | Sensitive personal metadata in a user profile | A public citation remains source-public, but its association with a private student profile is protected unless the student deliberately publishes it in a future feature. |
| Language-test status | Sensitive personal metadata | Store status, test type, date, score metadata, or expiry only when needed; no certificate or result-sheet file. |
| Shortlist | Private user data | Device-local for a Guest and account-private for a Student. Never disclose it to opportunity providers or advertisers. |
| Notes | Private user data | User-visible and user-controlled. Warn against entering unnecessary identifiers; do not copy note bodies into logs or analytics. |
| Application progress | Private user data | Includes tracker stage, checklist progress, tasks, and activity entered for the student's own planning. It never authorizes autonomous submission. |
| Document-readiness metadata | Sensitive personal metadata | Only metadata fields allowed by the metadata-only rule below; no underlying file, extracted content, or storage locator. |
| Referee contact details | Sensitive personal metadata | Third-party data: collect only the minimum the student needs, do not contact a referee without an explicit later workflow, and never use it for marketing. |
| Notifications | Private user data | Preferences, reminders, destinations, delivery state, and message history are private; message bodies must be minimised. No paid email, SMS, or WhatsApp dependency. |
| Logs | Restricted operational data | Keep security/diagnostic logs content-minimised, access-controlled, and short-lived; never log secrets, prohibited files, full notes, or full AI prompts. |
| Analytics | Internal when aggregated; Restricted operational data while raw | Prefer aggregate or de-identified counts. Raw events may use only limited, rotating or pseudonymous identifiers and must not carry sensitive fields. |
| AI prompts and responses | Private user data; Sensitive personal metadata when such context is strictly necessary | Default to public opportunity facts and the minimum user context needed for the requested answer. Do not retain or repurpose unnecessary sensitive content. |
| API keys | Restricted operational data | Server-side secret storage only. Keys are injected into one scoped service and may be used but never listed, returned, logged, exported, or sent to the client. |
| Passwords | Restricted operational data for non-reversible verifier material; plaintext is forbidden | Use an approved authentication service or password hashing design later. No role may view plaintext passwords or password-equivalent credentials. |
| Passports | Prohibited Year 1 data for files, images, scans, machine-readable content, and passport numbers | A metadata-only readiness state may be Sensitive personal metadata; the passport itself and unique identifier are outside Year 1 scope. |
| Transcripts | Prohibited Year 1 data for files, images, scans, OCR, and line-by-line contents | CGPA, scale, graduation status, and readiness metadata may be stored separately as Sensitive personal metadata. |
| Certificates | Prohibited Year 1 data for files, images, scans, OCR, and credential copies | Certification name, issuer, date, expiry, version label, and readiness may be stored as Sensitive personal metadata when necessary. |
| Financial documents | Prohibited Year 1 data | Do not collect bank statements, proof-of-funds files, tax records, payslips, bank-account details, images, OCR, or extracted financial-document content. A generic `not started`/`ready` requirement status may be Sensitive personal metadata. |

## Year 1 metadata-only document rule

For a required-document template, MasterDocumentRecord, or
ApplicationDocumentProgress record, the only student document representations
allowed in Year 1 are a template/type reference, readiness status, optional
expiry date, user-defined version label, requirement/checklist relationship,
and created/updated timestamps. A minimal non-sensitive user label may be
allowed after abuse review.

The record must not contain or point to a file, binary, image, thumbnail,
base64 value, object-storage key, upload token, cloud-drive link accessible to
ScholarTrack, OCR text, document number, financial value, or copied document
contents. There must be no sensitive-file upload endpoint, form control,
presigned URL flow, AI attachment path, or object-storage bucket for this
purpose in the Year 1 core product.

## Guest mode and confirmed migration

- Guest shortlist, notes, tasks, checklist, and progress remain in browser-local
  storage and are not silently transmitted to ScholarTrack.
- Account creation and migration are separate decisions. Before migration, show
  the categories and item counts, allow selection, explain the destination and
  deletion effect, and require affirmative confirmation.
- Migration must be idempotent and must not overwrite newer account data. The
  system confirms successful server persistence before offering to remove the
  local copy; local deletion requires its own clear confirmation.
- Declining or cancelling migration leaves guest data local and keeps guest mode
  usable. Signing in alone is not migration consent.
- Local export and local permanent deletion must be available without an
  account. Browser clearing or device loss can remove unexported guest data and
  must be explained before reliance on local tracking.

## Export and permanent deletion

Students must be able to export their private and sensitive metadata in a
documented, machine-readable format without receiving other users' data,
restricted secrets, or internal security material. Guests must receive an
equivalent local export for supported local records.

Students must also be able to request permanent deletion of their hosted private
data. Deletion must revoke active sessions and future processing, remove live
records, propagate a deletion marker so backups cannot silently restore the
account, and age deleted content out of backups under a documented maximum
schedule. Where an audit or security record cannot be erased, it must contain
the least possible information and replace the user link with a pseudonymous or
non-reversible reference where feasible. The precise recovery window, backup
maximum, statutory exceptions, and request-response period must be decided and
legally reviewed before hosted accounts launch; no current document promises an
invented legal period.

## AI minimisation boundary

- Deterministic eligibility rules operate separately from AI. AI may explain
  source-grounded results but must not turn an unknown rule into eligibility.
- Send only the public opportunity facts and minimum student fields necessary
  for the student's immediate request. Exclude names, contact details, referee
  details, identifiers, free-form notes, and sensitive metadata unless each is
  demonstrably necessary and the user is informed.
- Prohibited Year 1 files and their extracted contents are never accepted as AI
  input. Secrets and raw operational logs are never prompt context.
- Do not retain prompts or responses beyond the user-visible history or a short,
  documented operational need. Do not use student content for model training,
  advertising, or unrelated product profiling. Provider retention and training
  terms must be verified before integration.
- AI-content access by staff is exceptional and audited. Prefer redacted error
  metadata over prompt bodies for diagnosis.

## Operational privacy controls

- **Secrets:** keep secrets in a server-side environment or secret manager.
  Use separate, least-privileged, rotatable credentials per service. Never
  commit real values or expose them through `NEXT_PUBLIC_*` variables.
- **Staff access:** private student data is not part of ordinary review or
  administration. Exceptional access requires a case, reason, authorisation,
  limited fields, expiry, and audit trail visible to the privacy function.
- **Logs:** establish an automatic, limited retention schedule before any
  production collection. Diagnostic detail must expire sooner than the minimal
  security evidence that justifies a longer policy. Exact periods remain a
  launch-gate decision after security and legal review.
- **Analytics:** collect product counts without persistent personal identifiers
  where possible. If an identifier is necessary, use a scoped, rotating or
  pseudonymous value; never include profile, eligibility, note, prompt,
  document, referee, or notification content.
- **Advertising:** only controlled, clearly disclosed placements are in scope.
  Shortlists, profiles, eligibility, documents, notes, prompts, and application
  progress must not be used for ad targeting or disclosed to advertisers.
- **No sale:** student data, attention profiles, and derived eligibility data
  must not be sold. A future commercial arrangement requires privacy, security,
  cost, and legal review and cannot weaken this boundary silently.

## Pre-launch privacy decision gates

Before enabling accounts, analytics, AI, or advertising in production, the team
must document the applicable jurisdictions and age rules, name all processors,
verify international transfer and provider-retention terms, set enforceable raw
and backup retention maxima, test export and deletion, complete a threat/privacy
review, and publish accurate user notices. Until those decisions are complete,
the relevant collection remains disabled rather than operating under an
assumed legal basis.
