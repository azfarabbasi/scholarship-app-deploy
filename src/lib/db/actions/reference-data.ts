"use server";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canManageOrganisations, canManageTaxonomies } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import type { ActionResult } from "./opportunities";

export async function createOrganisation(input: {
  legalName: string;
  displayName: string;
  kind: (typeof schema.organisationKindEnum.enumValues)[number];
  websiteUrl?: string;
}): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session || !canManageOrganisations(session.roles)) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [organisation] = await db
    .insert(schema.organisations)
    .values({
      legalName: input.legalName,
      displayName: input.displayName,
      kind: input.kind,
      websiteUrl: input.websiteUrl || null,
      status: "active",
      createdByStaffProfileId: session.staffProfileId,
      updatedByStaffProfileId: session.staffProfileId,
    })
    .returning();

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "create",
    entityName: "organisations",
    entityId: organisation.id,
    redactedChangeSummary: `Created organisation "${input.displayName}".`,
  });

  revalidatePath("/staff/organisations");
  return { ok: true };
}

export async function createProvider(input: {
  organisationId: string;
  displayName: string;
  officialWebsiteUrl?: string;
}): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session || !canManageOrganisations(session.roles)) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [provider] = await db
    .insert(schema.providers)
    .values({
      organisationId: input.organisationId,
      displayName: input.displayName,
      officialWebsiteUrl: input.officialWebsiteUrl || null,
      status: "active",
      createdByStaffProfileId: session.staffProfileId,
      updatedByStaffProfileId: session.staffProfileId,
    })
    .returning();

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "create",
    entityName: "providers",
    entityId: provider.id,
    redactedChangeSummary: `Created provider "${input.displayName}".`,
  });

  revalidatePath("/staff/organisations");
  return { ok: true };
}

type TaxonomyKind = "region" | "study-level" | "field-of-study" | "funding-type" | "document-template";

export async function createTaxonomyValue(kind: TaxonomyKind, input: { code: string; label: string }): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session || !canManageTaxonomies(session.roles)) return { ok: false, error: "Not permitted." };

  const db = getDb();
  switch (kind) {
    case "region":
      await db.insert(schema.regions).values({ code: input.code, name: input.label, status: "active" });
      break;
    case "study-level":
      await db.insert(schema.studyLevels).values({ code: input.code, label: input.label, status: "active" });
      break;
    case "field-of-study":
      await db.insert(schema.fieldsOfStudy).values({ code: input.code, label: input.label, status: "active" });
      break;
    case "funding-type":
      await db.insert(schema.fundingTypes).values({ code: input.code, label: input.label, status: "active" });
      break;
    case "document-template":
      await db.insert(schema.requiredDocumentTemplates).values({ code: input.code, label: input.label, category: "other", status: "active" });
      break;
  }

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "create",
    entityName: kind,
    entityId: null,
    redactedChangeSummary: `Created ${kind} "${input.label}".`,
  });

  revalidatePath("/staff/taxonomies");
  revalidatePath("/staff/documents");
  return { ok: true };
}
