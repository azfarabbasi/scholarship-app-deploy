import { describe, expect, it } from "vitest";
import { detectDuplicatePairs, type DuplicateDetectionCandidate } from "@/lib/duplicates/detect";

function makeCandidate(overrides: Partial<DuplicateDetectionCandidate>): DuplicateDetectionCandidate {
  return {
    id: "id-1",
    title: "Example Scholarship",
    providerId: "provider-1",
    applicationUrl: null,
    officialWebsiteUrl: null,
    legacyMigrationReference: null,
    ...overrides,
  };
}

describe("detectDuplicatePairs", () => {
  it("flags an identical legacy migration reference as a certain duplicate", () => {
    const a = makeCandidate({ id: "a", legacyMigrationReference: "legacy-id-1" });
    const b = makeCandidate({ id: "b", title: "Different Title", providerId: "provider-2", legacyMigrationReference: "legacy-id-1" });
    const [pair] = detectDuplicatePairs([a, b]);
    expect(pair.confidenceScore).toBe(1);
    expect(pair.reason).toMatch(/legacy migration reference/i);
  });

  it("flags an identical normalized official URL regardless of protocol/www/trailing slash differences", () => {
    const a = makeCandidate({ id: "a", applicationUrl: "https://www.example.edu/apply/" });
    const b = makeCandidate({ id: "b", title: "Other Title", providerId: "provider-2", applicationUrl: "http://example.edu/apply" });
    const [pair] = detectDuplicatePairs([a, b]);
    expect(pair.confidenceScore).toBeGreaterThanOrEqual(0.9);
  });

  it("flags the same provider with the same normalized title", () => {
    const a = makeCandidate({ id: "a", title: "DAAD Scholarship — 2027" });
    const b = makeCandidate({ id: "b", title: "daad scholarship 2027" });
    const pairs = detectDuplicatePairs([a, b]);
    expect(pairs).toHaveLength(1);
  });

  it("flags similar titles under the same provider as a lower-confidence fuzzy candidate", () => {
    const a = makeCandidate({ id: "a", title: "Helmholtz Research School Fellowships" });
    const b = makeCandidate({ id: "b", title: "Helmholtz Research School Fellowships Program" });
    const pairs = detectDuplicatePairs([a, b]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].confidenceScore).toBeLessThan(0.9);
  });

  it("does not flag genuinely different opportunities from different providers", () => {
    const a = makeCandidate({ id: "a", title: "DAAD Scholarships for Foreign Students", providerId: "provider-1" });
    const b = makeCandidate({ id: "b", title: "Erasmus Mundus Joint Master Degrees", providerId: "provider-2" });
    expect(detectDuplicatePairs([a, b])).toHaveLength(0);
  });

  it("never compares a record against itself and never double-counts a pair", () => {
    const a = makeCandidate({ id: "a", legacyMigrationReference: "legacy-id-1" });
    const b = makeCandidate({ id: "b", legacyMigrationReference: "legacy-id-1" });
    const c = makeCandidate({ id: "c", legacyMigrationReference: "legacy-id-1" });
    const pairs = detectDuplicatePairs([a, b, c]);
    expect(pairs).toHaveLength(3); // a-b, a-c, b-c — each unordered pair exactly once
  });
});
