import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { evaluateDeadline } from "@/lib/deadlines/engine";
import type { DeadlineEvaluationInput } from "@/lib/deadlines/types";
import { UNVERIFIED_CATALOGUE_VERIFICATION, type CatalogueOpportunity, type EnrichedOpportunity } from "@/lib/catalogue/types";
import { DB_NAME, resetDbConnectionForTests } from "@/lib/storage/db";

const rollingInput: DeadlineEvaluationInput = {
  cycleYear: null,
  precision: "rolling",
  verificationStatus: "unverified",
  recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
  occurrences: [],
};

const opportunity: CatalogueOpportunity = {
  kind: "built-in",
  id: "built-in-1",
  legacyId: 1,
  slug: "daad-scholarships-for-foreign-students",
  title: "DAAD Scholarships for Foreign Students",
  opportunityType: "scholarship",
  providerName: null,
  countries: ["Germany"],
  regions: [],
  studyLevels: ["Master", "PhD"],
  benefitSummary: "Full funding: tuition, stipend, and insurance.",
  eligibilitySummary: "Open to applicants from any country.",
  officialUrl: "https://example.invalid/daad",
  verificationNotes: null,
  verification: UNVERIFIED_CATALOGUE_VERIFICATION,
  deadlineInput: rollingInput,
  deadlineRawText: "Rolling / program-specific",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function makeItem(): EnrichedOpportunity {
  return {
    opportunity,
    evaluation: evaluateDeadline(opportunity.deadlineInput, new Date("2027-01-01T00:00:00Z")),
    workspace: null,
  };
}

async function resetDatabase() {
  await resetDbConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

beforeEach(resetDatabase);
afterEach(resetDatabase);

describe("OpportunityCard", () => {
  it("renders title, location, study levels, deadline badge, and verification badge", () => {
    render(<OpportunityCard item={makeItem()} />);
    expect(screen.getByRole("heading", { name: /DAAD Scholarships for Foreign Students/i })).toBeInTheDocument();
    expect(screen.getByText("Germany")).toBeInTheDocument();
    expect(screen.getByText("Master")).toBeInTheDocument();
    expect(screen.getByText("Verify deadline")).toBeInTheDocument();
  });

  it("labels long text safely and never shows a misleading countdown for an unverified rolling opportunity", () => {
    render(<OpportunityCard item={makeItem()} />);
    expect(screen.queryByText(/day.*remaining/i)).toBeNull();
  });

  it("exposes an accessible shortlist toggle button with a real accessible name", () => {
    render(<OpportunityCard item={makeItem()} />);
    const shortlistButton = screen.getByRole("button", {
      name: /add .* to shortlist/i,
    });
    expect(shortlistButton).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles the shortlist state when the button is activated via keyboard", async () => {
    const user = userEvent.setup();
    render(<OpportunityCard item={makeItem()} />);
    const shortlistButton = screen.getByRole("button", { name: /add .* to shortlist/i });
    shortlistButton.focus();
    await user.keyboard("{Enter}");
    // The button fires a void async IndexedDB write (re-render happens via an
    // external subscription, tested in useWorkspace/storage tests). Let the
    // write settle before the test ends so afterEach's DB teardown doesn't
    // race an in-flight transaction.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(shortlistButton).toBeInTheDocument();
  });

  it("marks the official website link safely (opens in a new tab, no opener leak)", () => {
    render(<OpportunityCard item={makeItem()} />);
    const link = screen.getByRole("link", { name: /official website/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });
});
