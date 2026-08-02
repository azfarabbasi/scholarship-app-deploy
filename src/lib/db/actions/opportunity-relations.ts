"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canManageDocumentsAndEligibility } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { enableBootstrapAdminConstraintBypass } from "@/lib/db/bootstrap-admin-bypass";
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

/**
 * Attaches a new source as a `candidate` — never immediately
 * `confirmed-official`. Confirming that the source is genuinely authoritative
 * and current is a separate, independently-actored step: {@link confirmOfficialSource}.
 * `lastCheckedAt` is still recorded here (candidates may legitimately have
 * been glanced at while drafting), but a candidate can never satisfy the
 * publish-gate trigger in `0010_publication_integrity_actors.sql` — only a
 * confirmed source can.
 */
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
      status: "candidate",
      lastCheckedAt: new Date(input.lastCheckedAt),
      createdByStaffProfileId: session.staffProfileId,
    })
    .returning();

  await db.insert(schema.opportunityOfficialSources).values({ opportunityId, officialSourceId: source.id });

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "official_sources",
    entityId: source.id,
    redactedChangeSummary: `Attached candidate source "${input.label}" to opportunity ${opportunityId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

/**
 * Confirms a candidate source as genuinely official — the independently
 * actored step `addOfficialSource` deliberately never performs itself. The
 * confirming staff member must differ from whoever captured the candidate
 * (enforced here and, as a hard backstop, by the
 * `official_sources_no_self_approval` CHECK constraint).
 */
export async function confirmOfficialSource(opportunityId: string, officialSourceId: string, lastCheckedAt: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [source] = await db.select().from(schema.officialSources).where(eq(schema.officialSources.id, officialSourceId));
  if (!source) return { ok: false, error: "Source not found." };
  const [link] = await db
    .select({ officialSourceId: schema.opportunityOfficialSources.officialSourceId })
    .from(schema.opportunityOfficialSources)
    .where(
      and(
        eq(schema.opportunityOfficialSources.opportunityId, opportunityId),
        eq(schema.opportunityOfficialSources.officialSourceId, officialSourceId),
      ),
    );
  if (!link) return { ok: false, error: "That source is not attached to this opportunity." };
  if (source.status !== "candidate") return { ok: false, error: "Only a candidate source can be confirmed." };
  const usesBootstrapOverride =
    Boolean(source.createdByStaffProfileId) && source.createdByStaffProfileId === session.staffProfileId;
  if (usesBootstrapOverride && !session.isBootstrapAdmin) {
    return { ok: false, error: "You captured this candidate source — a different reviewer must confirm it." };
  }

  await db.transaction(async (tx) => {
    await enableBootstrapAdminConstraintBypass(tx, usesBootstrapOverride ? session.staffProfileId : null);
    await tx
      .update(schema.officialSources)
      .set({ status: "confirmed-official", lastCheckedAt: new Date(lastCheckedAt), approvedByStaffProfileId: session.staffProfileId })
      .where(eq(schema.officialSources.id, officialSourceId));

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: usesBootstrapOverride ? "administrator" : (session.roles[0] ?? null),
      action: "update",
      entityName: "official_sources",
      entityId: officialSourceId,
      redactedChangeSummary: usesBootstrapOverride
        ? `Bootstrap administrator full-access override: confirmed official source ${officialSourceId}.`
        : `Confirmed official source ${officialSourceId} for opportunity ${opportunityId}.`,
    });
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

/** Captures evidence as `captured` — never immediately `accepted`; see {@link acceptSourceEvidence}. */
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
      status: "captured",
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

/** Accepts captured evidence — the accepting staff member must differ from whoever captured it. */
export async function acceptSourceEvidence(opportunityId: string, sourceEvidenceId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [evidence] = await db.select().from(schema.sourceEvidence).where(eq(schema.sourceEvidence.id, sourceEvidenceId));
  if (!evidence) return { ok: false, error: "Evidence not found." };
  if (evidence.opportunityId !== opportunityId) {
    return { ok: false, error: "That evidence does not belong to this opportunity." };
  }
  if (evidence.status !== "captured") return { ok: false, error: "Only captured evidence can be accepted." };
  const usesBootstrapOverride = evidence.capturedByStaffProfileId === session.staffProfileId;
  if (usesBootstrapOverride && !session.isBootstrapAdmin) {
    return { ok: false, error: "You captured this evidence — a different reviewer must accept it." };
  }

  await db.transaction(async (tx) => {
    await enableBootstrapAdminConstraintBypass(tx, usesBootstrapOverride ? session.staffProfileId : null);
    await tx
      .update(schema.sourceEvidence)
      .set({ status: "accepted", approvedByStaffProfileId: session.staffProfileId })
      .where(eq(schema.sourceEvidence.id, sourceEvidenceId));

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: usesBootstrapOverride ? "administrator" : (session.roles[0] ?? null),
      action: "update",
      entityName: "source_evidence",
      entityId: sourceEvidenceId,
      redactedChangeSummary: usesBootstrapOverride
        ? `Bootstrap administrator full-access override: accepted source evidence ${sourceEvidenceId}.`
        : `Accepted source evidence ${sourceEvidenceId} for opportunity ${opportunityId}.`,
    });
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

async function evidenceBelongsToOpportunity(sourceEvidenceId: string, opportunityId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: schema.sourceEvidence.id })
    .from(schema.sourceEvidence)
    .where(and(eq(schema.sourceEvidence.id, sourceEvidenceId), eq(schema.sourceEvidence.opportunityId, opportunityId)));
  return Boolean(row);
}

/**
 * Created as `draft` — never immediately `published`; see {@link publishDocumentRequirement}.
 * Also the last line of defense (the database trigger
 * `opportunity_document_requirements_evidence_matches_opportunity` is the
 * real one) against attaching evidence captured for a different opportunity.
 */
export async function addDocumentRequirement(opportunityId: string, input: AddDocumentRequirementInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  if (!(await evidenceBelongsToOpportunity(input.sourceEvidenceId, opportunityId))) {
    return { ok: false, error: "That source evidence does not belong to this opportunity." };
  }

  const db = getDb();
  await db.insert(schema.opportunityDocumentRequirements).values({
    opportunityId,
    requiredDocumentTemplateId: input.requiredDocumentTemplateId,
    requirementLevel: input.requirementLevel,
    instructions: input.instructions || null,
    sourceEvidenceId: input.sourceEvidenceId,
    status: "draft",
    createdByStaffProfileId: session.staffProfileId,
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

/** Created as `draft` — never immediately `active`; see {@link activateEligibilityRule}. */
export async function addEligibilityRule(opportunityId: string, input: AddEligibilityRuleInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  if (!(await evidenceBelongsToOpportunity(input.sourceEvidenceId, opportunityId))) {
    return { ok: false, error: "That source evidence does not belong to this opportunity." };
  }

  const db = getDb();
  let [group] = await db
    .select()
    .from(schema.eligibilityRuleGroups)
    .where(eq(schema.eligibilityRuleGroups.opportunityId, opportunityId))
    .limit(1);

  if (!group) {
    [group] = await db
      .insert(schema.eligibilityRuleGroups)
      .values({ opportunityId, label: "General eligibility", operator: "all", status: "draft" })
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
    status: "draft",
    createdByStaffProfileId: session.staffProfileId,
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

/** Created as `draft` — never immediately `published`; see {@link publishFundingBenefit}. */
export async function addFundingBenefit(opportunityId: string, input: AddFundingBenefitInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db.insert(schema.fundingBenefits).values({
    opportunityId,
    fundingTypeId: input.fundingTypeId,
    kind: input.kind,
    summary: input.summary,
    status: "draft",
    createdByStaffProfileId: session.staffProfileId,
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
 * the surrounding record was approved. The promoting staff member must also
 * differ from whoever drafted the record — self-promotion is rejected here
 * and, as a hard backstop, by each table's own `*_no_self_approval` CHECK.
 */
export async function publishFundingBenefit(opportunityId: string, fundingBenefitId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [benefit] = await db.select().from(schema.fundingBenefits).where(eq(schema.fundingBenefits.id, fundingBenefitId));
  if (!benefit) return { ok: false, error: "Funding benefit not found." };
  if (benefit.opportunityId !== opportunityId) {
    return { ok: false, error: "That funding benefit does not belong to this opportunity." };
  }
  if (benefit.status !== "draft") return { ok: false, error: "Only a draft funding benefit can be published." };
  const usesBootstrapOverride =
    Boolean(benefit.createdByStaffProfileId) && benefit.createdByStaffProfileId === session.staffProfileId;
  if (usesBootstrapOverride && !session.isBootstrapAdmin) {
    return { ok: false, error: "You drafted this funding benefit — a different reviewer must publish it." };
  }

  await db.transaction(async (tx) => {
    await enableBootstrapAdminConstraintBypass(tx, usesBootstrapOverride ? session.staffProfileId : null);
    await tx
      .update(schema.fundingBenefits)
      .set({ status: "published", approvedByStaffProfileId: session.staffProfileId })
      .where(eq(schema.fundingBenefits.id, fundingBenefitId));

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: usesBootstrapOverride ? "administrator" : (session.roles[0] ?? null),
      action: "update",
      entityName: "funding_benefits",
      entityId: fundingBenefitId,
      redactedChangeSummary: usesBootstrapOverride
        ? "Bootstrap administrator full-access override: promoted a funding benefit to published."
        : "Promoted a funding benefit to published.",
    });
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export async function activateEligibilityRule(opportunityId: string, eligibilityRuleId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [rule] = await db.select().from(schema.eligibilityRules).where(eq(schema.eligibilityRules.id, eligibilityRuleId));
  if (!rule) return { ok: false, error: "Eligibility rule not found." };
  if (rule.opportunityId !== opportunityId) {
    return { ok: false, error: "That eligibility rule does not belong to this opportunity." };
  }
  if (rule.status !== "draft") return { ok: false, error: "Only a draft eligibility rule can be activated." };
  const usesBootstrapOverride =
    Boolean(rule.createdByStaffProfileId) && rule.createdByStaffProfileId === session.staffProfileId;
  if (usesBootstrapOverride && !session.isBootstrapAdmin) {
    return { ok: false, error: "You drafted this eligibility rule — a different reviewer must activate it." };
  }

  await db.transaction(async (tx) => {
    await enableBootstrapAdminConstraintBypass(tx, usesBootstrapOverride ? session.staffProfileId : null);
    await tx
      .update(schema.eligibilityRules)
      .set({ status: "active", approvedByStaffProfileId: session.staffProfileId })
      .where(eq(schema.eligibilityRules.id, eligibilityRuleId));

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: usesBootstrapOverride ? "administrator" : (session.roles[0] ?? null),
      action: "update",
      entityName: "eligibility_rules",
      entityId: eligibilityRuleId,
      redactedChangeSummary: usesBootstrapOverride
        ? "Bootstrap administrator full-access override: activated an eligibility rule."
        : "Activated an eligibility rule.",
    });
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export async function publishDocumentRequirement(opportunityId: string, requirementId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [requirement] = await db
    .select()
    .from(schema.opportunityDocumentRequirements)
    .where(eq(schema.opportunityDocumentRequirements.id, requirementId));
  if (!requirement) return { ok: false, error: "Document requirement not found." };
  if (requirement.opportunityId !== opportunityId) {
    return { ok: false, error: "That document requirement does not belong to this opportunity." };
  }
  if (requirement.status !== "draft") {
    return { ok: false, error: "Only a draft document requirement can be published." };
  }
  const usesBootstrapOverride =
    Boolean(requirement.createdByStaffProfileId) && requirement.createdByStaffProfileId === session.staffProfileId;
  if (usesBootstrapOverride && !session.isBootstrapAdmin) {
    return { ok: false, error: "You drafted this document requirement — a different reviewer must publish it." };
  }

  await db.transaction(async (tx) => {
    await enableBootstrapAdminConstraintBypass(tx, usesBootstrapOverride ? session.staffProfileId : null);
    await tx
      .update(schema.opportunityDocumentRequirements)
      .set({ status: "published", approvedByStaffProfileId: session.staffProfileId })
      .where(eq(schema.opportunityDocumentRequirements.id, requirementId));

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: usesBootstrapOverride ? "administrator" : (session.roles[0] ?? null),
      action: "update",
      entityName: "opportunity_document_requirements",
      entityId: requirementId,
      redactedChangeSummary: usesBootstrapOverride
        ? "Bootstrap administrator full-access override: promoted a document requirement to published."
        : "Promoted a document requirement to published.",
    });
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}
