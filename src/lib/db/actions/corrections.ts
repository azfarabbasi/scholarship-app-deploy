"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canTriageCorrections } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import type { ActionResult } from "./opportunities";

async function requireEditorSession() {
  const session = await getStaffSession();
  if (!session || !canTriageCorrections(session.roles)) return null;
  return session;
}

export async function assignCorrection(correctionReportId: string, assigneeStaffProfileId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db
    .update(schema.correctionReports)
    .set({ status: "assigned", assignedStaffProfileId: assigneeStaffProfileId, updatedAt: new Date() })
    .where(eq(schema.correctionReports.id, correctionReportId));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "assign",
    entityName: "correction_reports",
    entityId: correctionReportId,
    redactedChangeSummary: "Assigned a correction report.",
  });

  revalidatePath("/staff/corrections");
  return { ok: true };
}

async function transitionCorrection(
  correctionReportId: string,
  status: (typeof schema.correctionReportStatusEnum.enumValues)[number],
  resolutionSummary: string | null,
): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const isTerminal = status === "resolved" || status === "rejected" || status === "closed";
  await db
    .update(schema.correctionReports)
    .set({
      status,
      resolutionSummary: resolutionSummary ?? undefined,
      resolvedByStaffProfileId: isTerminal ? session.staffProfileId : null,
      resolvedAt: isTerminal ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.correctionReports.id, correctionReportId));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "correction_reports",
    entityId: correctionReportId,
    reasonCode: resolutionSummary ?? undefined,
    redactedChangeSummary: `Correction report set to "${status}".`,
  });

  revalidatePath("/staff/corrections");
  return { ok: true };
}

export async function investigateCorrection(correctionReportId: string) {
  return transitionCorrection(correctionReportId, "investigating", null);
}
export async function resolveCorrection(correctionReportId: string, resolutionSummary: string) {
  return transitionCorrection(correctionReportId, "resolved", resolutionSummary);
}
export async function rejectCorrection(correctionReportId: string, resolutionSummary: string) {
  return transitionCorrection(correctionReportId, "rejected", resolutionSummary);
}
export async function reopenCorrection(correctionReportId: string) {
  return transitionCorrection(correctionReportId, "investigating", null);
}
