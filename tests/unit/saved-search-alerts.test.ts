import { describe, expect, it } from "vitest";
import { diffSavedSearchResults } from "@/lib/discovery/saved-search-alerts";

describe("diffSavedSearchResults", () => {
  it("has no alert when the result set hasn't changed at all", () => {
    const result = diffSavedSearchResults(["a", "b"], ["a", "b"]);
    expect(result.hasAlert).toBe(false);
    expect(result.messages).toEqual([]);
  });

  it("has no alert when both snapshots are empty", () => {
    const result = diffSavedSearchResults([], []);
    expect(result.hasAlert).toBe(false);
  });

  it("is order-independent — the same ids in a different order produce no alert", () => {
    const result = diffSavedSearchResults(["a", "b", "c"], ["c", "a", "b"]);
    expect(result.hasAlert).toBe(false);
  });

  it("reports newly added opportunities", () => {
    const result = diffSavedSearchResults(["a"], ["a", "b", "c"]);
    expect(result.hasAlert).toBe(true);
    expect(result.newOpportunityCount).toBe(2);
    expect(result.removedOpportunityCount).toBe(0);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toContain("2 newly published opportunities match");
  });

  it("reports removed opportunities", () => {
    const result = diffSavedSearchResults(["a", "b", "c"], ["a"]);
    expect(result.hasAlert).toBe(true);
    expect(result.newOpportunityCount).toBe(0);
    expect(result.removedOpportunityCount).toBe(2);
    expect(result.messages[0]).toContain("no longer in your results");
  });

  it("uses singular phrasing for exactly one added or removed item", () => {
    const added = diffSavedSearchResults(["a"], ["a", "b"]);
    expect(added.messages[0]).toContain("1 newly published opportunity matches");

    const removed = diffSavedSearchResults(["a", "b"], ["a"]);
    expect(removed.messages[0]).toContain("1 previously matching opportunity is");
  });

  it("reports both additions and removals together with two distinct messages", () => {
    const result = diffSavedSearchResults(["a", "b"], ["a", "c"]);
    expect(result.hasAlert).toBe(true);
    expect(result.newOpportunityCount).toBe(1);
    expect(result.removedOpportunityCount).toBe(1);
    expect(result.messages).toHaveLength(2);
  });

  it("never invents an alert for a first-time (empty previous) snapshot with no results yet", () => {
    const result = diffSavedSearchResults([], []);
    expect(result.hasAlert).toBe(false);
  });
});
