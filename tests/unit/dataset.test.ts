import { describe, expect, it } from "vitest";
import {
  EXPECTED_BUILT_IN_COUNT,
  getAllBuiltInOpportunities,
  getBuiltInOpportunityByLegacyId,
  getBuiltInOpportunityBySlug,
  getBuiltInOpportunityById,
  getInvalidBuiltInRecordCount,
  getUniqueCountries,
  getUniqueOpportunityTypes,
  getUniqueStudyLevels,
} from "@/lib/catalogue/repository";

describe("built-in opportunity dataset", () => {
  it("loads exactly 55 built-in records", () => {
    expect(getAllBuiltInOpportunities()).toHaveLength(EXPECTED_BUILT_IN_COUNT);
  });

  it("has zero invalid/skipped records", () => {
    expect(getInvalidBuiltInRecordCount()).toBe(0);
  });

  it("has unique built-in IDs", () => {
    const ids = getAllBuiltInOpportunities().map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique slugs", () => {
    const slugs = getAllBuiltInOpportunities().map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has non-empty titles for every record", () => {
    for (const opportunity of getAllBuiltInOpportunities()) {
      expect(opportunity.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("marks every built-in record with kind 'built-in'", () => {
    for (const opportunity of getAllBuiltInOpportunities()) {
      expect(opportunity.kind).toBe("built-in");
    }
  });

  it("looks up a record by slug", () => {
    const first = getAllBuiltInOpportunities()[0];
    expect(getBuiltInOpportunityBySlug(first.slug)?.id).toBe(first.id);
  });

  it("looks up a record by legacy ID", () => {
    expect(getBuiltInOpportunityByLegacyId(1)?.slug).toBe("daad-scholarships-for-foreign-students");
  });

  it("looks up a record by composite ID", () => {
    expect(getBuiltInOpportunityById("built-in-1")?.legacyId).toBe(1);
  });

  it("returns undefined for a missing slug, legacy ID, or ID (no throw)", () => {
    expect(getBuiltInOpportunityBySlug("does-not-exist")).toBeUndefined();
    expect(getBuiltInOpportunityByLegacyId(9999)).toBeUndefined();
    expect(getBuiltInOpportunityById("built-in-9999")).toBeUndefined();
  });

  it("exposes non-empty unique countries, study levels, and opportunity types", () => {
    expect(getUniqueCountries().length).toBeGreaterThan(0);
    expect(getUniqueStudyLevels().length).toBeGreaterThan(0);
    expect(getUniqueOpportunityTypes()).toEqual(["scholarship"]);
  });

  it("reports the four migration precisions with the Checkpoint 0 audited counts", () => {
    const counts: Record<string, number> = { exact: 0, estimated: 0, rolling: 0, unknown: 0 };
    for (const opportunity of getAllBuiltInOpportunities()) {
      counts[opportunity.deadlineInput.precision] += 1;
    }
    expect(counts.exact).toBe(24);
    expect(counts.estimated).toBe(20);
    expect(counts.rolling).toBe(5);
    expect(counts.unknown).toBe(6);
  });
});
