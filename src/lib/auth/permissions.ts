/**
 * Server-side authorization, encoding `docs/checkpoint-0/roles-and-permissions.md`
 * as executable checks. This is the ONLY place a mutation should ask "is this
 * allowed" — every Server Action / Route Handler in `app/staff/**` and
 * `app/api/staff/**` must call one of these functions before writing
 * anything, never trust client-side navigation gating alone.
 *
 * "Own / Assigned" cells from the permission matrix are ownership/assignment
 * checks the caller passes in explicitly (this module has no database
 * access of its own), because only the call site knows which record is being
 * acted on.
 */

export const STAFF_ROLES = ["reviewer", "senior_reviewer", "administrator", "system_service"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

function hasAnyRole(roles: readonly StaffRole[], allowed: readonly StaffRole[]): boolean {
  return roles.some((role) => allowed.includes(role));
}

/** Reviewer, Senior Reviewer, or Administrator may create a new opportunity draft. */
export function canCreateDraft(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["reviewer", "senior_reviewer", "administrator"]);
}

/** Editing a draft requires ownership or explicit assignment, checked by the caller. */
export function canEditDraft(roles: readonly StaffRole[], isOwnerOrAssigned: boolean): boolean {
  return hasAnyRole(roles, ["reviewer", "senior_reviewer", "administrator"]) && isOwnerOrAssigned;
}

/**
 * Local-testing convenience only, controlled by the `ALLOW_ADMIN_SELF_REVIEW`
 * env flag (see `src/lib/env.ts`): when the caller passes
 * `adminSelfReviewAllowed: true` (only ever wired up when that flag is set),
 * an Administrator may review/approve any draft, including their own,
 * collapsing the review pipeline to a single account for solo testing. The
 * flag defaults to unset/false everywhere, so separation of duties is
 * unchanged unless a deployment explicitly opts in — never enable it outside
 * a local/dev environment.
 */
interface SelfReviewOptions {
  adminSelfReviewAllowed?: boolean;
}

/**
 * A Reviewer/Senior Reviewer may review an assigned revision, but never their
 * own draft — `authorStaffProfileId` is the revision's author, `staffProfileId`
 * the caller.
 */
export function canReview(
  roles: readonly StaffRole[],
  staffProfileId: string,
  authorStaffProfileId: string | null,
  options?: SelfReviewOptions,
): boolean {
  if (options?.adminSelfReviewAllowed && hasAnyRole(roles, ["administrator"])) {
    return true;
  }
  if (!hasAnyRole(roles, ["reviewer", "senior_reviewer"])) {
    return false;
  }
  return authorStaffProfileId !== staffProfileId;
}

/**
 * Only a Senior Reviewer may approve, and never their own draft. Administrator
 * approval is an *override*, tracked separately via {@link isAdministratorOverride}.
 */
export function canApprove(
  roles: readonly StaffRole[],
  staffProfileId: string,
  authorStaffProfileId: string | null,
  options?: SelfReviewOptions,
): boolean {
  if (options?.adminSelfReviewAllowed && hasAnyRole(roles, ["administrator"])) {
    return true;
  }
  if (hasAnyRole(roles, ["senior_reviewer"]) && authorStaffProfileId !== staffProfileId) {
    return true;
  }
  return false;
}

/** An Administrator may approve/publish their own or another's revision only via a reasoned, audited override. */
export function isAdministratorOverride(roles: readonly StaffRole[], reason: string | null | undefined): boolean {
  return hasAnyRole(roles, ["administrator"]) && Boolean(reason && reason.trim().length > 0);
}

/** Publishing requires an independent approval to already exist (checked by the caller against verification/version state). */
export function canPublish(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

export function canArchive(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

export function canRestore(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

export function canAssignReviewers(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

export function canManageTaxonomies(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

export function canManageOrganisations(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

/** Documents/eligibility rules are drafted like opportunity content: own/assigned, any editorial role. */
export function canManageDocumentsAndEligibility(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["reviewer", "senior_reviewer", "administrator"]);
}

export function canTriageCorrections(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["reviewer", "senior_reviewer", "administrator"]);
}

/** Merging is high-impact and irreversible-by-default; restrict to the same roles as archive/publish. */
export function canManageDuplicates(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

/** Bulk import (legacy migration or CSV) is Administrator-only per the Checkpoint 2 brief. */
export function canRunImports(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["administrator"]);
}

export function canManageStaff(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["administrator"]);
}

/** Full audit log browsing is Administrator-only; Senior Reviewer sees their review-scoped assignments in-context instead. */
export function canViewFullAuditLog(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["administrator"]);
}

export function isAdministrator(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["administrator"]);
}

// --- Checkpoint 5: AI assistant ------------------------------------------------------

/** Drafting/editing an AI source excerpt is content curation, same roles as documents/eligibility. */
export function canManageAiSources(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["reviewer", "senior_reviewer", "administrator"]);
}

/** Approving/rejecting/marking-stale an AI source is the publish-equivalent action — same roles as `canPublish`. */
export function canApproveAiSources(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

/** Rebuilding chunks/embeddings and running the evaluation harness are operational actions, same roles as `canManageDuplicates`. */
export function canRunAiEvaluations(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

/** Aggregate AI usage dashboards — the same "assigned"/aggregate-visibility tier as taxonomies/organisations management. */
export function canViewAiUsage(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["senior_reviewer", "administrator"]);
}

/** Safety/abuse event logs are sensitive operational data, same tier as the full audit log. */
export function canViewAiSafetyLog(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["administrator"]);
}

/** The runtime AI kill switch is an Administrator-only incident-response action. */
export function canDisableAi(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["administrator"]);
}

// --- Checkpoint 6: production readiness ------------------------------------

/** Operational diagnostics (/staff/ops) surface configuration/connectivity state — same sensitivity tier as the full audit log. */
export function canViewOpsDiagnostics(roles: readonly StaffRole[]): boolean {
  return hasAnyRole(roles, ["administrator"]);
}
