import { describe, expect, it } from "vitest";
import {
  canApprove,
  canArchive,
  canAssignReviewers,
  canCreateDraft,
  canEditDraft,
  canManageDuplicates,
  canManageStaff,
  canPublish,
  canReview,
  canRunImports,
  canTriageCorrections,
  canViewFullAuditLog,
  isAdministratorOverride,
} from "@/lib/auth/permissions";

describe("permission matrix", () => {
  it("only reviewer/senior_reviewer/administrator may create drafts", () => {
    expect(canCreateDraft(["reviewer"])).toBe(true);
    expect(canCreateDraft(["senior_reviewer"])).toBe(true);
    expect(canCreateDraft(["administrator"])).toBe(true);
    expect(canCreateDraft(["system_service"])).toBe(false);
    expect(canCreateDraft([])).toBe(false);
  });

  it("editing a draft requires ownership or assignment even for an editorial role", () => {
    expect(canEditDraft(["reviewer"], true)).toBe(true);
    expect(canEditDraft(["reviewer"], false)).toBe(false);
    expect(canEditDraft(["system_service"], true)).toBe(false);
  });

  it("a reviewer can never review their own draft", () => {
    expect(canReview(["reviewer"], "staff-1", "staff-2")).toBe(true);
    expect(canReview(["reviewer"], "staff-1", "staff-1")).toBe(false);
    expect(canReview(["reviewer"], "staff-1", null)).toBe(true);
  });

  it("only senior_reviewer may approve, and never their own draft", () => {
    expect(canApprove(["senior_reviewer"], "staff-1", "staff-2")).toBe(true);
    expect(canApprove(["senior_reviewer"], "staff-1", "staff-1")).toBe(false);
    expect(canApprove(["reviewer"], "staff-1", "staff-2")).toBe(false);
    expect(canApprove(["administrator"], "staff-1", "staff-2")).toBe(false);
  });

  it("an administrator override requires both the role and a non-empty reason", () => {
    expect(isAdministratorOverride(["administrator"], "documented reason")).toBe(true);
    expect(isAdministratorOverride(["administrator"], "")).toBe(false);
    expect(isAdministratorOverride(["administrator"], undefined)).toBe(false);
    expect(isAdministratorOverride(["administrator"], "   ")).toBe(false);
    expect(isAdministratorOverride(["senior_reviewer"], "reason")).toBe(false);
  });

  it("publish/archive/restore/assign are senior_reviewer or administrator only", () => {
    for (const check of [canPublish, canArchive, canAssignReviewers]) {
      expect(check(["senior_reviewer"])).toBe(true);
      expect(check(["administrator"])).toBe(true);
      expect(check(["reviewer"])).toBe(false);
    }
  });

  it("duplicate management is restricted like publish/archive", () => {
    expect(canManageDuplicates(["senior_reviewer"])).toBe(true);
    expect(canManageDuplicates(["reviewer"])).toBe(false);
  });

  it("imports, staff management, and full audit log are administrator-only", () => {
    for (const check of [canRunImports, canManageStaff, canViewFullAuditLog]) {
      expect(check(["administrator"])).toBe(true);
      expect(check(["senior_reviewer"])).toBe(false);
      expect(check(["reviewer"])).toBe(false);
    }
  });

  it("any editorial role may triage corrections", () => {
    expect(canTriageCorrections(["reviewer"])).toBe(true);
    expect(canTriageCorrections(["senior_reviewer"])).toBe(true);
    expect(canTriageCorrections(["administrator"])).toBe(true);
    expect(canTriageCorrections(["system_service"])).toBe(false);
  });

  it("a staff member holding multiple roles is granted the union of their permissions", () => {
    expect(canPublish(["reviewer", "senior_reviewer"])).toBe(true);
    expect(canRunImports(["reviewer", "senior_reviewer"])).toBe(false);
  });
});
