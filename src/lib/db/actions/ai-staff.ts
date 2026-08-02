"use server";

import { count, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canApproveAiSources, canDisableAi, canManageAiSources, canRunAiEvaluations, canViewAiSafetyLog, canViewAiUsage } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { buildChunkDrafts } from "@/lib/ai/rag/chunking";
import { EVALUATION_CASES } from "@/lib/ai/evaluation/cases";
import { runAllEvaluationCases } from "@/lib/ai/evaluation/harness";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// --- Source document management (staff) --------------------------------------------

export type AiSourceDocumentRow = typeof schema.aiSourceDocuments.$inferSelect;
export type AiSourceStatus = (typeof schema.aiSourceStatusEnum.enumValues)[number];

export async function listAiSourceDocuments(): Promise<AiSourceDocumentRow[]> {
  const session = await getStaffSession();
  if (!session || !canManageAiSources(session.roles)) return [];
  const db = getDb();
  return db.select().from(schema.aiSourceDocuments).orderBy(desc(schema.aiSourceDocuments.updatedAt));
}

export interface CreateAiSourceDocumentInput {
  title: string;
  sourceText: string;
  opportunityId?: string | null;
  officialSourceId?: string | null;
  requiredDocumentId?: string | null;
  eligibilityRuleId?: string | null;
}

async function requireManageSession() {
  const session = await getStaffSession();
  if (!session || !canManageAiSources(session.roles)) return null;
  return session;
}

async function requireApproveSession() {
  const session = await getStaffSession();
  if (!session || !canApproveAiSources(session.roles)) return null;
  return session;
}

export async function createAiSourceDocument(input: CreateAiSourceDocumentInput): Promise<ActionResult & { id?: string }> {
  const session = await requireManageSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const title = input.title.trim();
  const sourceText = input.sourceText.trim();
  if (!title || !sourceText) return { ok: false, error: "Title and source text are required." };

  const db = getDb();
  const [created] = await db
    .insert(schema.aiSourceDocuments)
    .values({
      title,
      sourceText,
      opportunityId: input.opportunityId ?? null,
      officialSourceId: input.officialSourceId ?? null,
      requiredDocumentId: input.requiredDocumentId ?? null,
      eligibilityRuleId: input.eligibilityRuleId ?? null,
      status: "draft",
      createdByStaffProfileId: session.staffProfileId,
    })
    .returning({ id: schema.aiSourceDocuments.id });

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "create",
    entityName: "ai_source_documents",
    entityId: created.id,
    redactedChangeSummary: `Created a draft AI source excerpt: "${title}".`,
  });

  revalidatePath("/staff/ai/sources");
  return { ok: true, id: created.id };
}

export interface UpdateAiSourceDocumentInput {
  title?: string;
  sourceText?: string;
}

export async function updateAiSourceDocument(id: string, patch: UpdateAiSourceDocumentInput): Promise<ActionResult> {
  const session = await requireManageSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db
    .update(schema.aiSourceDocuments)
    .set({
      title: patch.title?.trim(),
      sourceText: patch.sourceText?.trim(),
      // Editing a previously-approved excerpt must go through re-approval — never silently stays "approved" (ADR-010).
      status: "draft",
      updatedAt: new Date(),
    })
    .where(eq(schema.aiSourceDocuments.id, id));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "ai_source_documents",
    entityId: id,
    redactedChangeSummary: "Edited an AI source excerpt (reset to draft, pending re-approval).",
  });

  revalidatePath("/staff/ai/sources");
  return { ok: true };
}

export async function setAiSourceDocumentStatus(id: string, status: AiSourceStatus, staleReason?: string): Promise<ActionResult> {
  const requiresApproval = status === "approved" || status === "rejected" || status === "stale";
  const session = requiresApproval ? await requireApproveSession() : await requireManageSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [existing] = await db.select().from(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.id, id)).limit(1);
  if (!existing) return { ok: false, error: "Source document not found." };

  // The document's own status and its chunks' status must never fall out of
  // sync — retrieval (`src/lib/ai/rag/retrieval.ts`) filters chunks by their
  // OWN `status` column, not the parent document's, so a crash or error
  // between two separate, non-transactional writes here could leave
  // rejected/stale chunks retrievable (document flipped, chunks didn't) or
  // approved content unreachable (document flipped, chunks stuck on draft)
  // until someone notices and re-triggers a rebuild.
  await db.transaction(async (tx) => {
    await tx
      .update(schema.aiSourceDocuments)
      .set({
        status,
        staleReason: status === "stale" ? (staleReason?.trim() ?? null) : null,
        approvedByStaffProfileId: status === "approved" ? session.staffProfileId : existing.approvedByStaffProfileId,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiSourceDocuments.id, id));

    await tx
      .update(schema.aiSourceChunks)
      .set({ status, opportunityId: existing.opportunityId, officialSourceId: existing.officialSourceId, updatedAt: new Date() })
      .where(eq(schema.aiSourceChunks.documentId, id));
  });

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: status === "approved" ? "approve" : status === "rejected" ? "reject" : "update",
    entityName: "ai_source_documents",
    entityId: id,
    redactedChangeSummary: `Set AI source excerpt status to "${status}".`,
  });

  revalidatePath("/staff/ai/sources");
  return { ok: true };
}

/** Re-derives chunks from the document's current text — the only way stored chunk content ever changes. */
export async function rebuildAiSourceChunks(documentId: string): Promise<ActionResult & { chunkCount?: number }> {
  const session = await requireManageSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [document] = await db.select().from(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.id, documentId)).limit(1);
  if (!document) return { ok: false, error: "Source document not found." };

  const drafts = buildChunkDrafts(document.sourceText);

  await db.transaction(async (tx) => {
    await tx.delete(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.documentId, documentId));
    if (drafts.length > 0) {
      await tx.insert(schema.aiSourceChunks).values(
        drafts.map((draft) => ({
          documentId,
          opportunityId: document.opportunityId,
          officialSourceId: document.officialSourceId,
          chunkIndex: draft.chunkIndex,
          chunkText: draft.chunkText,
          tokenCountEstimate: draft.tokenCountEstimate,
          status: document.status,
        })),
      );
    }
  });

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "ai_source_chunks",
    entityId: documentId,
    redactedChangeSummary: `Rebuilt ${drafts.length} chunk(s) for an AI source document.`,
  });

  revalidatePath("/staff/ai/sources");
  return { ok: true, chunkCount: drafts.length };
}

export async function rebuildAllAiSourceChunks(): Promise<ActionResult & { documentCount?: number }> {
  const session = await requireManageSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const documents = await db.select({ id: schema.aiSourceDocuments.id }).from(schema.aiSourceDocuments);
  for (const document of documents) {
    await rebuildAiSourceChunks(document.id);
  }

  revalidatePath("/staff/ai/sources");
  return { ok: true, documentCount: documents.length };
}

// --- Retrieval coverage report -------------------------------------------------------

export interface AiCoverageReport {
  totalPublishedOpportunities: number;
  opportunitiesWithApprovedChunks: number;
  opportunitiesMissingCoverage: { id: string; title: string; slug: string }[];
  documentCountsByStatus: Record<AiSourceStatus, number>;
  staleDocumentCount: number;
}

export async function getAiRetrievalCoverageReport(): Promise<AiCoverageReport | null> {
  const session = await getStaffSession();
  if (!session || !canManageAiSources(session.roles)) return null;

  const db = getDb();
  const published = await db
    .select({ id: schema.opportunities.id, title: schema.opportunities.title, slug: schema.opportunities.slug })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.status, "published"));

  const approvedChunkOpportunityIds = await db
    .selectDistinct({ opportunityId: schema.aiSourceChunks.opportunityId })
    .from(schema.aiSourceChunks)
    .where(eq(schema.aiSourceChunks.status, "approved"));
  const coveredIds = new Set(approvedChunkOpportunityIds.map((row) => row.opportunityId).filter((id): id is string => id !== null));

  const statusCounts = await db
    .select({ status: schema.aiSourceDocuments.status, total: count() })
    .from(schema.aiSourceDocuments)
    .groupBy(schema.aiSourceDocuments.status);

  const documentCountsByStatus: Record<AiSourceStatus, number> = { draft: 0, approved: 0, rejected: 0, stale: 0 };
  for (const row of statusCounts) {
    documentCountsByStatus[row.status] = Number(row.total);
  }

  return {
    totalPublishedOpportunities: published.length,
    opportunitiesWithApprovedChunks: coveredIds.size,
    opportunitiesMissingCoverage: published.filter((o) => !coveredIds.has(o.id)),
    documentCountsByStatus,
    staleDocumentCount: documentCountsByStatus.stale,
  };
}

// --- Evaluation harness (staff-triggered) --------------------------------------------

export type AiEvaluationCaseRow = typeof schema.aiEvaluationCases.$inferSelect;
export type AiEvaluationRunRow = typeof schema.aiEvaluationRuns.$inferSelect;

export async function listAiEvaluationCases(): Promise<AiEvaluationCaseRow[]> {
  const session = await getStaffSession();
  if (!session || !canRunAiEvaluations(session.roles)) return [];
  const db = getDb();
  return db.select().from(schema.aiEvaluationCases).orderBy(schema.aiEvaluationCases.key);
}

export async function listAiEvaluationRuns(limit = 50): Promise<AiEvaluationRunRow[]> {
  const session = await getStaffSession();
  if (!session || !canRunAiEvaluations(session.roles)) return [];
  const db = getDb();
  return db.select().from(schema.aiEvaluationRuns).orderBy(desc(schema.aiEvaluationRuns.createdAt)).limit(limit);
}

/**
 * Runs the full fixture set (`src/lib/ai/evaluation/cases.ts`) against the
 * mock provider and persists one `ai_evaluation_runs` row per case —
 * upserting a matching `ai_evaluation_cases` row first so the fixture set
 * and its run history stay linked even as cases are added over time.
 */
export async function triggerAiEvaluationRun(): Promise<ActionResult & { passed?: number; total?: number }> {
  const session = await getStaffSession();
  if (!session || !canRunAiEvaluations(session.roles)) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const summary = await runAllEvaluationCases();

  for (const result of summary.results) {
    const fixture = EVALUATION_CASES.find((c) => c.key === result.key);
    const [caseRow] = await db
      .insert(schema.aiEvaluationCases)
      .values({
        key: result.key,
        scope: fixture?.scope ?? "general",
        prompt: fixture?.prompt ?? "",
        expectations: fixture?.expectations ?? {},
      })
      .onConflictDoUpdate({
        target: schema.aiEvaluationCases.key,
        set: { prompt: fixture?.prompt ?? "", expectations: fixture?.expectations ?? {} },
      })
      .returning({ id: schema.aiEvaluationCases.id });

    await db.insert(schema.aiEvaluationRuns).values({
      evaluationCaseId: caseRow.id,
      provider: "mock",
      result: result.passed ? "pass" : "fail",
      details: { finalText: result.finalText, failures: result.failures },
    });
  }

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "create",
    entityName: "ai_evaluation_runs",
    entityId: null,
    redactedChangeSummary: `Ran the AI evaluation suite: ${summary.passed}/${summary.total} passed.`,
  });

  revalidatePath("/staff/ai/evaluations");
  return { ok: true, passed: summary.passed, total: summary.total };
}

// --- Usage dashboard ------------------------------------------------------------------

export interface AiUsageSummary {
  signedInStudentsWithUsageToday: number;
  totalSignedInRequestsToday: number;
  totalConversations: number;
  totalMessages: number;
  totalFeedbackEntries: number;
}

export async function getAiUsageSummary(): Promise<AiUsageSummary | null> {
  const session = await getStaffSession();
  if (!session || !canViewAiUsage(session.roles)) return null;

  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const [usageRows, conversationCount, messageCount, feedbackCount] = await Promise.all([
    db.select().from(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.usageDate, today)),
    db.select({ total: count() }).from(schema.aiConversations),
    db.select({ total: count() }).from(schema.aiMessages),
    db.select({ total: count() }).from(schema.aiFeedback),
  ]);

  return {
    signedInStudentsWithUsageToday: usageRows.length,
    totalSignedInRequestsToday: usageRows.reduce((sum, row) => sum + row.requestCount, 0),
    totalConversations: Number(conversationCount[0]?.total ?? 0),
    totalMessages: Number(messageCount[0]?.total ?? 0),
    totalFeedbackEntries: Number(feedbackCount[0]?.total ?? 0),
  };
}

export type AiFeedbackRow = typeof schema.aiFeedback.$inferSelect;

export async function listAiFeedback(limit = 50): Promise<AiFeedbackRow[]> {
  const session = await getStaffSession();
  if (!session || !canViewAiUsage(session.roles)) return [];
  const db = getDb();
  return db.select().from(schema.aiFeedback).orderBy(desc(schema.aiFeedback.createdAt)).limit(limit);
}

// --- Safety log ------------------------------------------------------------------------

export type AiSafetyEventRow = typeof schema.aiSafetyEvents.$inferSelect;

export async function listAiSafetyEvents(limit = 100): Promise<AiSafetyEventRow[]> {
  const session = await getStaffSession();
  if (!session || !canViewAiSafetyLog(session.roles)) return [];
  const db = getDb();
  return db.select().from(schema.aiSafetyEvents).orderBy(desc(schema.aiSafetyEvents.createdAt)).limit(limit);
}

// --- Provider health / kill switch ------------------------------------------------------

export interface AiProviderHealthRow {
  id: string;
  manuallyDisabled: boolean;
  disabledReason: string | null;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

export async function getAiProviderHealth(): Promise<AiProviderHealthRow | null> {
  const session = await getStaffSession();
  if (!session) return null;
  const db = getDb();
  const [row] = await db.select().from(schema.aiProviderHealth).limit(1);
  if (!row) return { id: "", manuallyDisabled: false, disabledReason: null, lastCheckedAt: null, lastStatus: null, lastError: null };
  return {
    id: row.id,
    manuallyDisabled: row.manuallyDisabled,
    disabledReason: row.disabledReason,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
  };
}

export async function setAiManuallyDisabled(disabled: boolean, reason?: string): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session || !canDisableAi(session.roles)) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [existing] = await db.select({ id: schema.aiProviderHealth.id }).from(schema.aiProviderHealth).limit(1);

  if (existing) {
    await db
      .update(schema.aiProviderHealth)
      .set({
        manuallyDisabled: disabled,
        disabledReason: disabled ? (reason?.trim() ?? null) : null,
        disabledByStaffProfileId: disabled ? session.staffProfileId : null,
        disabledAt: disabled ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiProviderHealth.id, existing.id));
  } else {
    await db.insert(schema.aiProviderHealth).values({
      manuallyDisabled: disabled,
      disabledReason: disabled ? (reason?.trim() ?? null) : null,
      disabledByStaffProfileId: disabled ? session.staffProfileId : null,
      disabledAt: disabled ? new Date() : null,
    });
  }

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "ai_provider_health",
    entityId: null,
    redactedChangeSummary: disabled ? `Manually disabled the AI assistant. Reason: ${reason?.trim() || "not specified"}` : "Re-enabled the AI assistant.",
  });

  revalidatePath("/staff/ai");
  return { ok: true };
}
