import { describe, expect, it } from "vitest";
import { parseSearchQuery, searchQueryToParams } from "@/lib/search/query";
import type { SearchQuery } from "@/lib/search/types";

describe("parseSearchQuery", () => {
  it("returns sane defaults for an empty URLSearchParams", () => {
    const query = parseSearchQuery(new URLSearchParams());
    expect(query.q).toBe("");
    expect(query.countries).toEqual([]);
    expect(query.sort).toBe("relevance");
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(12);
    expect(query.requiredDocumentsOnly).toBe(false);
    expect(query.eligibilityRulesOnly).toBe(false);
  });

  it("splits comma-separated facet params into arrays", () => {
    const params = new URLSearchParams({ countries: "Germany,France", levels: "Master,PhD" });
    const query = parseSearchQuery(params);
    expect(query.countries).toEqual(["Germany", "France"]);
    expect(query.studyLevels).toEqual(["Master", "PhD"]);
  });

  it("trims whitespace and drops empty entries from comma-separated params", () => {
    const params = new URLSearchParams({ countries: "Germany, , France ,," });
    expect(parseSearchQuery(params).countries).toEqual(["Germany", "France"]);
  });

  it("coerces boolean-flag params", () => {
    const params = new URLSearchParams({ hasDocuments: "true", hasEligibility: "true" });
    const query = parseSearchQuery(params);
    expect(query.requiredDocumentsOnly).toBe(true);
    expect(query.eligibilityRulesOnly).toBe(true);
  });

  it("falls back to full defaults when a param is invalid, rather than throwing", () => {
    const params = new URLSearchParams({ page: "not-a-number", sort: "not-a-real-sort-mode" });
    const query = parseSearchQuery(params);
    expect(query).toEqual(parseSearchQuery(new URLSearchParams()));
  });

  it("caps page and pageSize to their schema-enforced bounds", () => {
    expect(parseSearchQuery(new URLSearchParams({ page: "0" })).page).toBe(1); // below min falls back to default
    expect(parseSearchQuery(new URLSearchParams({ pageSize: "500" })).pageSize).toBe(12); // above max falls back to default
  });

  it("rejects a fundingCategories value outside the known enum, falling back to defaults", () => {
    const query = parseSearchQuery(new URLSearchParams({ funding: "not-a-real-category" }));
    expect(query.fundingCategories).toEqual([]);
  });
});

describe("searchQueryToParams", () => {
  it("omits every field that equals its default", () => {
    const params = searchQueryToParams({ q: "", sort: "relevance", page: 1, pageSize: 12 });
    expect(params.toString()).toBe("");
  });

  it("includes only non-default fields", () => {
    const params = searchQueryToParams({ q: "daad", countries: ["Germany"], sort: "nearest-deadline", page: 2 });
    expect(params.get("q")).toBe("daad");
    expect(params.get("countries")).toBe("Germany");
    expect(params.get("sort")).toBe("nearest-deadline");
    expect(params.get("page")).toBe("2");
    expect(params.has("levels")).toBe(false);
  });

  it("round-trips through parseSearchQuery — this is exactly the saved-search URL contract", () => {
    const original: SearchQuery = {
      q: "engineering scholarship",
      countries: ["Germany", "France"],
      regions: ["Europe"],
      studyLevels: ["Master"],
      opportunityTypes: ["scholarship"],
      fields: ["engineering"],
      providers: ["DAAD"],
      fundingCategories: ["tuition"],
      deadlineStates: ["open"],
      precisions: ["exact"],
      verificationStatuses: ["verified"],
      requiredDocumentsOnly: true,
      eligibilityRulesOnly: true,
      sort: "verified-first",
      page: 3,
      pageSize: 24,
    };
    const roundTripped = parseSearchQuery(searchQueryToParams(original));
    expect(roundTripped).toEqual(original);
  });
});
