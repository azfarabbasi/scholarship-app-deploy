"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canManageDocumentsAndEligibility } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import type { ActionResult } from "./opportunities";

async function requireEditorSession() {
  const session = await getStaffSession();
  if (!session || !canManageDocumentsAndEligibility(session.roles)) {
    return null;
  }
  return session;
}

export interface AddOfficialSourceInput {
  url: string;
  kind: (typeof schema.officialSourceKindEnum.enumValues)[number];
  label: string;
  sourceOrganisationName: string;
  publisherProviderId?: string;
  publisherOrganisationId?: string;
  lastCheckedAt: string;
}

export async function addOfficialSource(opportunityId: string, input: AddOfficialSourceInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [source] = await db
    .insert(schema.officialSources)
    .values({
      url: input.url,
      kind: input.kind,
      label: input.label,
      sourceOrganisationName: input.sourceOrganisationName,
      publisherProviderId: input.publisherProviderId || null,
      publisherOrganisationId: input.publisherOrganisationId || null,
      status: "confirmed-official",
      lastCheckedAt: new Date(input.lastCheckedAt),
    })
    .returning();

  await db.insert(schema.opportunityOfficialSources).values({ opportunityId, officialSourceId: source.id });

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "official_sources",
    entityId: source.id,
    redactedChangeSummary: `Attached official source "${input.label}" to opportunity ${opportunityId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export interface AddSourceEvidenceInput {
  officialSourceId: string;
  kind: (typeof schema.sourceEvidenceKindEnum.enumValues)[number];
  evidenceText: string;
  sourceLocator?: string;
}

export async function addSourceEvidence(opportunityId: string, input: AddSourceEvidenceInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [evidence] = await db
    .insert(schema.sourceEvidence)
    .values({
      opportunityId,
      officialSourceId: input.officialSourceId,
      kind: input.kind,
      evidenceText: input.evidenceText,
      sourceLocator: input.sourceLocator || null,
      capturedByStaffProfileId: session.staffProfileId,
      status: "accepted",
    })
    .returning();

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "create",
    entityName: "source_evidence",
    entityId: evidence.id,
    redactedChangeSummary: `Captured source evidence for opportunity ${opportunityId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export interface AddDocumentRequirementInput {
  requiredDocumentTemplateId: string;
  requirementLevel: (typeof schema.documentRequirementLevelEnum.enumValues)[number];
  instructions?: string;
  sourceEvidenceId: string;
}

export async function addDocumentRequirement(opportunityId: string, input: AddDocumentRequirementInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db.insert(schema.opportunityDocumentRequirements).values({
    opportunityId,
    requiredDocumentTemplateId: input.requiredDocumentTemplateId,
    requirementLevel: input.requirementLevel,
    instructions: input.instructions || null,
    sourceEvidenceId: input.sourceEvidenceId,
    status: "published",
  });

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "opportunity_document_requirements",
    entityId: opportunityId,
    redactedChangeSummary: `Added a required-document entry to opportunity ${opportunityId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export interface AddEligibilityRuleInput {
  kind: (typeof schema.eligibilityRuleKindEnum.enumValues)[number];
  fieldKey: string;
  operator: (typeof schema.eligibilityOperatorEnum.enumValues)[number];
  expectedValue: string;
  explanation: string;
  sourceEvidenceId: string;
}

export async function addEligibilityRule(opportunityId: string, input: AddEligibilityRuleInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  let [group] = await db
    .select()
    .from(schema.eligibilityRuleGroups)
    .where(eq(schema.eligibilityRuleGroups.opportunityId, opportunityId))
    .limit(1);

  if (!group) {
    [group] = await db
      .insert(schema.eligibilityRuleGroups)
      .values({ opportunityId, label: "General eligibility", operator: "all", status: "active" })
      .returning();
  }

  await db.insert(schema.eligibilityRules).values({
    opportunityId,
    ruleGroupId: group.id,
    kind: input.kind,
    fieldKey: input.fieldKey,
    operator: input.operator,
    expectedValue: input.expectedValue,
    explanation: input.explanation,
    sourceEvidenceId: input.sourceEvidenceId,
    status: "active",
  });

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "eligibility_rules",
    entityId: opportunityId,
    redactedChangeSummary: `Added an eligibility rule to opportunity ${opportunityId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export async function setOpportunityTaxonomies(
  opportunityId: string,
  input: { countryIds: string[]; studyLevelIds: string[] },
): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.opportunityCountries).where(eq(schema.opportunityCountries.opportunityId, opportunityId));
    await tx.delete(schema.opportunityStudyLevels).where(eq(schema.opportunityStudyLevels.opportunityId, opportunityId));

    if (input.countryIds.length > 0) {
      await tx.insert(schema.opportunityCountries).values(input.countryIds.map((countryId) => ({ opportunityId, countryId })));
    }
    if (input.studyLevelIds.length > 0) {
      await tx
        .insert(schema.opportunityStudyLevels)
        .values(input.studyLevelIds.map((studyLevelId) => ({ opportunityId, studyLevelId })));
    }

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: session.roles[0] ?? null,
      action: "update",
      entityName: "opportunities",
      entityId: opportunityId,
      redactedChangeSummary: `Updated country/study-level coverage for opportunity ${opportunityId}.`,
    });
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export interface AddFundingBenefitInput {
  fundingTypeId: string;
  kind: (typeof schema.fundingBenefitKindEnum.enumValues)[number];
  summary: string;
}

export async function addFundingBenefit(opportunityId: string, input: AddFundingBenefitInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db.insert(schema.fundingBenefits).values({
    opportunityId,
    fundingTypeId: input.fundingTypeId,
    kind: input.kind,
    summary: input.summary,
    status: "published",
  });

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "funding_benefits",
    entityId: opportunityId,
    redactedChangeSummary: `Added a funding benefit to opportunity ${opportunityId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

/**
 * Draft-imported funding benefits / eligibility rules / document
 * requirements (e.g. from the legacy migration) never appear on the public
 * detail page until a reviewer explicitly promotes them — publishing the
 * parent opportunity does not cascade this automatically, so an unreviewed
 * historical claim can never silently become "official" text just because
 * the surrounding record was approved.
 */
export async function publishFundingBenefit(opportunityId: string, fundingBenefitId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db.update(schema.fundingBenefits).set({ status: "published" }).where(eq(schema.fundingBenefits.id, fundingBenefitId));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "funding_benefits",
    entityId: fundingBenefitId,
    redactedChangeSummary: "Promoted a funding benefit to published.",
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export async function activateEligibilityRule(opportunityId: string, eligibilityRuleId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db.update(schema.eligibilityRules).set({ status: "active" }).where(eq(schema.eligibilityRules.id, eligibilityRuleId));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "eligibility_rules",
    entityId: eligibilityRuleId,
    redactedChangeSummary: "Activated an eligibility rule.",
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export async function publishDocumentRequirement(opportunityId: string, requirementId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db
    .update(schema.opportunityDocumentRequirements)
    .set({ status: "published" })
    .where(eq(schema.opportunityDocumentRequirements.id, requirementId));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "opportunity_document_requirements",
    entityId: requirementId,
    redactedChangeSummary: "Promoted a document requirement to published.",
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}
