"use server";

import { sql } from "drizzle-orm";
import { recordAuditEvent } from "@/lib/audit/log";
import { canCreateDraft, canRunImports } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getPublishedOpportunities } from "@/lib/catalogue/db-repository";
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import { getDb, schema } from "@/lib/db/client";
import { extractExactVerifiedDeadline } from "@/lib/reminders/extract";
import { isTrgmAvailable, resetTrgmAvailabilityCache } from "@/lib/search/service";

export interface DiscoveryQualityItem {
  id: string;
  slug: string;
  title: string;
}

/**
 * Aggregate-only counts across ALL students' saved searches / reminders /
 * notifications — deliberately never a per-row listing. Staff have no
 * default read access to an individual student's discovery activity (see the
 * `ownerAllPolicy`-only RLS on these tables in `src/lib/db/schema/discovery.ts`);
 * this page respects that boundary at the application layer too, even though
 * the direct DB connection technically bypasses RLS, by only ever computing
 * `count(*)`-style statistics and never selecting a title, note, or query
 * text tied to a specific student.
 */
export interface DiscoveryQualityReport {
  /** Scope note: every queue below covers PUBLISHED opportunities only — exactly what students can currently discover. */
  totalPublished: number;
  staleVerification: DiscoveryQualityItem[];
  missingEligibilityRules: DiscoveryQualityItem[];
  missingRequiredDocuments: DiscoveryQualityItem[];
  missingTaxonomy: DiscoveryQualityItem[];
  unclearOfficialDeadline: DiscoveryQualityItem[];
  savedSearchStats: { total: number; alertsEnabled: number; neverChecked: number };
  reminderStats: { total: number; pending: number; dismissed: number; completed: number; overduePending: number };
  notificationStats: { total: number; unread: number };
  trgmAvailable: boolean;
}

async function requireDiscoveryViewerSession() {
  const session = await getStaffSession();
  if (!session || !canCreateDraft(session.roles)) return null;
  return session;
}

function toItem(opportunity: CatalogueOpportunity): DiscoveryQualityItem {
  return { id: opportunity.id, slug: opportunity.slug, title: opportunity.title };
}

export async function getDiscoveryQualityReport(): Promise<DiscoveryQualityReport | null> {
  const session = await requireDiscoveryViewerSession();
  if (!session) return null;

  const db = getDb();
  const opportunities = await getPublishedOpportunities();

  const staleVerification = opportunities.filter((o) => o.verification.status === "stale").map(toItem);
  const missingEligibilityRules = opportunities.filter((o) => o.eligibilityRules.length === 0).map(toItem);
  const missingRequiredDocuments = opportunities.filter((o) => o.verification.documentCount === 0).map(toItem);
  const missingTaxonomy = opportunities
    .filter((o) => o.countries.length === 0 && o.regions.length === 0 && o.studyLevels.length === 0)
    .map(toItem);
  // Mirrors `extractExactVerifiedDeadline` exactly: these are the opportunities for which
  // an official-deadline reminder can never be safely scheduled today.
  const unclearOfficialDeadline = opportunities.filter((o) => extractExactVerifiedDeadline(o) === null).map(toItem);

  const [[savedSearchAgg], [reminderAgg], [notificationAgg], trgmAvailable] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        alertsEnabled: sql<number>`count(*) filter (where ${schema.userSavedSearches.alertsEnabled})::int`,
        neverChecked: sql<number>`count(*) filter (where ${schema.userSavedSearches.lastCheckedAt} is null)::int`,
      })
      .from(schema.userSavedSearches),
    db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${schema.userReminders.status} = 'pending')::int`,
        dismissed: sql<number>`count(*) filter (where ${schema.userReminders.status} = 'dismissed')::int`,
        completed: sql<number>`count(*) filter (where ${schema.userReminders.status} = 'completed')::int`,
        overduePending: sql<number>`count(*) filter (where ${schema.userReminders.status} = 'pending' and ${schema.userReminders.dueAt} < now())::int`,
      })
      .from(schema.userReminders),
    db
      .select({
        total: sql<number>`count(*)::int`,
        unread: sql<number>`count(*) filter (where ${schema.userNotifications.status} = 'unread')::int`,
      })
      .from(schema.userNotifications),
    isTrgmAvailable(),
  ]);

  return {
    totalPublished: opportunities.length,
    staleVerification,
    missingEligibilityRules,
    missingRequiredDocuments,
    missingTaxonomy,
    unclearOfficialDeadline,
    savedSearchStats: {
      total: savedSearchAgg?.total ?? 0,
      alertsEnabled: savedSearchAgg?.alertsEnabled ?? 0,
      neverChecked: savedSearchAgg?.neverChecked ?? 0,
    },
    reminderStats: {
      total: reminderAgg?.total ?? 0,
      pending: reminderAgg?.pending ?? 0,
      dismissed: reminderAgg?.dismissed ?? 0,
      completed: reminderAgg?.completed ?? 0,
      overduePending: reminderAgg?.overduePending ?? 0,
    },
    notificationStats: {
      total: notificationAgg?.total ?? 0,
      unread: notificationAgg?.unread ?? 0,
    },
    trgmAvailable,
  };
}

/**
 * Refreshes Postgres planner statistics for the tables the trigram indexes
 * cover and re-checks `pg_trgm` availability. There is no separate,
 * app-managed search index to rebuild — ranking is computed live per request
 * (see `src/lib/search/service.ts`) — so this is the honest equivalent: it
 * can't invent an index that doesn't exist, but it does make sure query
 * planning and extension-availability detection reflect the database's
 * current state rather than a stale in-process cache.
 */
export async function rebuildSearchIndex(): Promise<{ ok: boolean; error?: string; trgmAvailable?: boolean }> {
  const session = await getStaffSession();
  if (!session || !canRunImports(session.roles)) return { ok: false, error: "Not permitted." };

  const db = getDb();
  try {
    await db.execute(sql`analyze opportunities`);
    await db.execute(sql`analyze providers`);
  } catch {
    // Best-effort only (e.g. a restricted hosting role may reject ANALYZE) — never blocks the cache reset below.
  }

  resetTrgmAvailabilityCache();
  const trgmAvailable = await isTrgmAvailable();

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "search_index",
    entityId: null,
    redactedChangeSummary: `Refreshed search planner statistics; pg_trgm availability re-checked as ${trgmAvailable ? "available" : "unavailable"}.`,
  });

  return { ok: true, trgmAvailable };
}
