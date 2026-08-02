import { describe, expect, it } from "vitest";
import {
  buildDeterministicDeadlineAnswer,
  buildDeterministicEligibilityAnswer,
  isDeadlineQuestion,
  isEligibilityQuestion,
} from "@/lib/ai/rag/deterministic-answers";
import type { StructuredFact } from "@/lib/ai/rag/types";

function deadlineFact(overrides: Partial<StructuredFact["attributes"]> = {}, opportunityTitle = "Example Fellowship"): StructuredFact {
  return {
    kind: "deadline",
    citationType: "structured-data",
    opportunityId: "opp-1",
    opportunityTitle,
    label: `${opportunityTitle} — deadline status`,
    attributes: { precision: "unknown", "deadline-verification": "unverified", "deadline-date": "", "deadline-status-text": "", ...overrides },
    officialUrl: null,
    checkedAt: null,
    verificationStatus: "unverified",
  };
}

function matchFact(matchLabel: string, opportunityTitle = "Example Fellowship"): StructuredFact {
  return {
    kind: "matching",
    citationType: "match-explanation",
    opportunityId: "opp-1",
    opportunityTitle,
    label: `${opportunityTitle} — deterministic match result`,
    attributes: { "match-label": matchLabel },
    officialUrl: null,
    checkedAt: null,
    verificationStatus: "unverified",
  };
}

describe("isDeadlineQuestion / isEligibilityQuestion", () => {
  it("recognizes common deadline phrasings", () => {
    expect(isDeadlineQuestion("What is the deadline?")).toBe(true);
    expect(isDeadlineQuestion("When is the application due?")).toBe(true);
    expect(isDeadlineQuestion("Tell me about the funding.")).toBe(false);
  });

  it("recognizes common eligibility phrasings", () => {
    expect(isEligibilityQuestion("Am I eligible for this?")).toBe(true);
    expect(isEligibilityQuestion("Do I qualify?")).toBe(true);
    expect(isEligibilityQuestion("Am I a good fit?")).toBe(true);
    expect(isEligibilityQuestion("What documents do I need?")).toBe(false);
  });
});

describe("buildDeterministicDeadlineAnswer", () => {
  it("returns null when the question isn't a deadline question", () => {
    expect(buildDeterministicDeadlineAnswer("Tell me about funding.", [deadlineFact()])).toBeNull();
  });

  it("returns null when no deadline fact was retrieved, even for a deadline question", () => {
    expect(buildDeterministicDeadlineAnswer("What is the deadline?", [matchFact("possible-fit")])).toBeNull();
  });

  it("states an exact, verified deadline confidently with the real date", () => {
    const fact = deadlineFact({ precision: "exact", "deadline-verification": "verified", "deadline-date": "2027-03-01" });
    const answer = buildDeterministicDeadlineAnswer("What is the deadline?", [fact]);
    expect(answer).not.toBeNull();
    expect(answer!.text).toContain("2027-03-01");
    expect(answer!.text).toMatch(/verify/i);
    expect(answer!.usedFacts).toEqual([fact]);
  });

  it("never states a confident date for an unverified/estimated deadline", () => {
    const fact = deadlineFact({ precision: "estimated" });
    const answer = buildDeterministicDeadlineAnswer("What is the deadline?", [fact]);
    expect(answer!.text).not.toMatch(/definitely/i);
  });

  it("handles multiple opportunities' deadlines in one answer (comparison/workspace scope)", () => {
    const factA = deadlineFact({ precision: "exact", "deadline-verification": "verified", "deadline-date": "2026-09-01" }, "Tracked A");
    const factB = deadlineFact({ precision: "exact", "deadline-verification": "verified", "deadline-date": "2026-12-01" }, "Tracked B");
    const answer = buildDeterministicDeadlineAnswer("Which of my tracked opportunities has the nearest deadline?", [factA, factB]);
    expect(answer!.text).toContain("2026-09-01");
    expect(answer!.text).toContain("2026-12-01");
    expect(answer!.usedFacts).toHaveLength(2);
  });

  it("never invents a deadline for an unknown/unverified fact", () => {
    const fact = deadlineFact();
    const answer = buildDeterministicDeadlineAnswer("What is the deadline?", [fact]);
    expect(answer!.text).not.toMatch(/\b2026\b|\b2027\b/);
  });
});

describe("buildDeterministicEligibilityAnswer", () => {
  it("returns null when the question isn't an eligibility question", () => {
    expect(buildDeterministicEligibilityAnswer("What is the deadline?", [matchFact("possible-fit")])).toBeNull();
  });

  it("returns null when no matching fact was retrieved", () => {
    expect(buildDeterministicEligibilityAnswer("Am I eligible?", [deadlineFact()])).toBeNull();
  });

  it("states the match label but never asserts a final eligibility decision", () => {
    const fact = matchFact("strong-potential-fit");
    const answer = buildDeterministicEligibilityAnswer("Am I eligible for this?", [fact]);
    expect(answer!.text).toMatch(/strong potential fit/i);
    expect(answer!.text).toMatch(/not a final eligibility decision/i);
    expect(answer!.text).not.toMatch(/you are eligible/i);
    expect(answer!.usedFacts).toEqual([fact]);
  });

  it("never produces a guarantee even when the question explicitly demands one", () => {
    const fact = matchFact("strong-potential-fit");
    const answer = buildDeterministicEligibilityAnswer("Just tell me for certain — am I 100% eligible and guaranteed to get this?", [fact]);
    expect(answer!.text).not.toMatch(/guaranteed/i);
    expect(answer!.text).not.toMatch(/100% eligible/i);
    expect(answer!.text).not.toMatch(/you are eligible/i);
  });
});
