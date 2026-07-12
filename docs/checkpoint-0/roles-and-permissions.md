# Checkpoint 0: Roles and permissions

## Purpose and authority model

This document defines the Year 1 authorization boundary for ScholarTrack. It is
a policy contract, not an authentication or database implementation. Guest mode
remains available, while accounts are optional and introduced later for
synchronisation.

Authorization is **deny by default**. A permission not explicitly granted here
is denied, regardless of whether a user interface happens to expose it. Every
grant is constrained to the smallest resource scope and shortest useful period.
Possessing a staff role does not grant access to student data, credentials, or
unrelated operational records. Role checks must be enforced server-side when a
server exists; hiding a control in the client is not authorization.

The six canonical roles are listed below. Staff roles may be combined with a
separate Student role only through an explicit assignment; staff status does not
implicitly grant student-workspace permissions.

### 1. Guest

An unauthenticated person using public discovery and device-local tracking.
Guest shortlist, checklist, progress, and notes remain in that person's browser
storage. Guest has no private cloud record and no background synchronisation.
Moving selected guest data into a new Student account requires an explicit,
reviewable confirmation.

### 2. Student

An authenticated person with an optional synchronised personal workspace. A
Student controls only their own profile, shortlist, application tracking,
document-readiness metadata, preferences, notes, tasks, reminders, AI usage, and
exports. A Student cannot access another student's data or any staff workflow.
No Student permission authorizes application submission by ScholarTrack or
sensitive student-file upload.

### 3. Reviewer

A staff curator who may create opportunity drafts and work only on explicitly
assigned review records. A Reviewer may not approve or publish. They may not
review a record they authored as the independent review, and they cannot publish
their own unreviewed work. Reviewer status provides no access to private student
workspaces.

### 4. Senior Reviewer

A staff quality role that assigns reviews, resolves editorial conflicts, and may
approve, publish, archive, or restore records within its assigned catalogue
scope. Approval requires independent evidence review: a Senior Reviewer must not
approve their own draft. Publishing is allowed only after the record has an
independent approval and the required official source, verification status, and
last-checked date. All such state transitions are audited.

### 5. Administrator

An operational role for user lifecycle, taxonomy, feature-flag, audit, and
controlled-advertising administration. Administrator is not a universal
superuser. Routine opportunity decisions belong to the review workflow, and
private student-data access is exceptional, purpose-bound, time-bound, and
audited. Administrative access never includes plaintext passwords, credentials,
or unrestricted secret retrieval.

### 6. System Service

A non-human identity created for one narrowly defined background job or runtime
capability. Each service identity receives only the records and operations its
job requires, uses a separately scoped credential, and is attributable in audit
events. A System Service cannot approve or publish opportunity facts, make an
eligibility policy decision through AI, autonomously submit an application, or
act as a general administrator.

## Permission vocabulary

Every matrix cell uses one of these values:

- **Allow** — permitted for the action's stated public or role-level scope. It
  is not permission to cross another resource boundary.
- **Own** — permitted only for a record owned by, or local to, the actor. An
  ownership check is mandatory.
- **Assigned** — permitted only for records, queues, functions, or fields
  explicitly assigned to that staff or service identity. Assignment and scope
  must be enforceable, not merely conventional.
- **Exceptional + Audited** — denied in routine work; permitted only through a
  documented support, safety, security, or recovery procedure with a reason,
  appropriate authorization, time-bound access, and an immutable audit event.
- **Deny** — not permitted by this role. Another separately assigned role may
  grant its own scoped permission, but this cell does not.

`Own / Assigned` means either ownership or explicit assignment must be proven.
Qualifiers in parentheses narrow a grant and never expand it.

## Permission matrix

| Capability | Guest | Student | Reviewer | Senior Reviewer | Administrator | System Service |
| --- | --- | --- | --- | --- | --- | --- |
| View published public opportunities | Allow | Allow | Allow | Allow | Allow | Allow |
| Use local guest tracking | Own (this browser only) | Own (unmigrated local data only) | Deny | Deny | Deny | Deny |
| Create an account | Allow (self-registration when enabled) | Allow (complete own registration) | Deny | Deny | Deny | Deny |
| Edit own profile | Deny (no cloud profile) | Own | Own (staff account settings only) | Own (staff account settings only) | Own (staff account settings only) | Deny |
| Manage own shortlist | Own (local only) | Own | Deny | Deny | Deny | Deny |
| Manage own application progress | Own (local only) | Own | Deny | Deny | Deny | Deny |
| Manage own document metadata | Own (local only; metadata only) | Own (metadata only) | Deny | Deny | Deny | Deny |
| Access another student's data | Deny | Deny | Deny | Exceptional + Audited | Exceptional + Audited | Assigned (minimum fields for one job) |
| Submit correction reports | Allow | Allow | Allow | Allow | Allow | Deny |
| Create opportunity drafts | Deny | Deny | Allow | Allow | Exceptional + Audited | Assigned (ingestion draft only) |
| Edit opportunity drafts | Deny | Deny | Own / Assigned | Own / Assigned | Exceptional + Audited | Assigned (normalisation only) |
| Review opportunity records | Deny | Deny | Assigned (not own draft) | Assigned (not own draft) | Exceptional + Audited | Deny |
| Approve opportunity records | Deny | Deny | Deny | Assigned (independent review only) | Exceptional + Audited | Deny |
| Publish opportunity records | Deny | Deny | Deny | Assigned (independently approved only) | Exceptional + Audited | Deny |
| Archive opportunity records | Deny | Deny | Deny | Assigned | Exceptional + Audited | Deny |
| Restore opportunity records | Deny | Deny | Deny | Assigned | Exceptional + Audited | Deny |
| Assign reviewers | Deny | Deny | Deny | Allow (within catalogue scope) | Assigned | Deny |
| Manage taxonomies | Deny | Deny | Deny | Assigned | Assigned | Deny |
| View audit logs | Deny | Deny | Own (own actions only) | Assigned (review scope only) | Assigned (operational scope only) | Deny (may append, not browse) |
| Manage users | Deny | Deny | Deny | Deny | Assigned | Assigned (lifecycle job only) |
| Manage feature flags | Deny | Deny | Deny | Deny | Assigned | Deny (may evaluate assigned flags) |
| View AI usage | Deny | Own | Own (own quota only) | Assigned (aggregate review usage) | Assigned (aggregate operational usage) | Assigned (quota counters only) |
| Manage advertising | Deny | Deny | Deny | Deny | Assigned | Assigned (delivery/event job only) |
| Access secrets | Deny | Deny | Deny | Deny | Deny | Assigned (runtime use only; never list or reveal) |
| Run scheduled jobs | Deny | Deny | Deny | Deny | Exceptional + Audited (approved manual trigger) | Assigned |

## Separation of duties and publication gates

- An author cannot supply the independent review or approval for the same
  opportunity revision. Reassignment does not erase authorship history.
- A Reviewer never approves or publishes. A Senior Reviewer may publish a
  revision only after another eligible reviewer has independently approved it.
- No opportunity revision may be published without official-source evidence,
  an explicit verification status, a last-checked date, and a resolved review
  decision. Estimated facts must remain visibly estimated.
- System-created or AI-assisted drafts remain drafts until a human reviewer
  checks the evidence and an independently authorised human approves them.
- Archival, restoration, correction disposition, and material taxonomy changes
  require reasons and produce auditable state transitions.

## Private-data and credential boundaries

- Guests cannot read or write private cloud records. Guest data stays local
  until the guest confirms a selective migration into a Student account.
- Staff review of opportunity data does not require access to student profiles,
  shortlists, notes, progress, document metadata, prompts, or notifications.
- Exceptional staff access to a student's private data must identify the case,
  purpose, authoriser, actor, permitted fields, start and expiry, and resulting
  action. Broad browsing and silent impersonation are forbidden.
- No human role or service interface can view plaintext passwords, API keys, or
  credentials. Password verification must use an approved authentication
  mechanism; secrets must be injected server-side and must not be returned,
  logged, exported, or embedded in client code.
- A service may use only its injected runtime secret and cannot enumerate the
  secret store. Service credentials must be distinct, scoped, and rotatable.

## Audit requirements

At minimum, the platform must audit opportunity approval, publication,
archival, restoration, reviewer assignment, taxonomy mutation, user suspension
or deletion, feature-flag mutation, advertising configuration, audit-log access,
exceptional private-data access, exceptional AI-content access, manual scheduled
job execution, and runtime-secret administration outside the application.

An audit event must identify the actor or service, role, action, target and
revision, timestamp, outcome, reason where required, and correlation identifier.
It must not copy passwords, API keys, prohibited files, full student notes, or
full AI prompts into the log. Audit records are append-only to ordinary roles;
retention and pseudonymisation are governed by the data-ownership policy.

## Implementation checks for later checkpoints

- Test every matrix boundary with both allowed and denied cases, including
  ownership, assignment, and expired exceptional-access grants.
- Test that changing authorship or assignment cannot bypass independent review.
- Test direct server calls, not only hidden buttons or client-side routes.
- Test that guest data is not transmitted before confirmed account migration.
- Test that service identities cannot call human approval, publication, or
  autonomous application-submission operations.
- Review the matrix whenever a role, data class, API, scheduled job, or third
  party is introduced. Any unlisted action remains denied.
