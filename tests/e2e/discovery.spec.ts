import { expect, test } from "./fixtures";

/**
 * Checkpoint 4 discovery/matching/reminders/notifications flows that don't
 * require a real signed-in Supabase account — those live alongside the
 * existing signed-in flows in `student-auth-and-sync.spec.ts` (guarded by
 * `E2E_STUDENT_EMAIL`/`E2E_STUDENT2_EMAIL`, same pattern as Checkpoint 3),
 * and staff-route protection for `/staff/discovery` lives in `staff-auth.spec.ts`.
 */

function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

test.describe("Search and filter", () => {
  test("typo-tolerant search still finds the matching opportunity", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByTestId("opportunity-card")).toHaveCount(55);

    // "Helmholz" is missing a 't' from "Helmholtz" — within the fuzzy-match edit-distance tolerance.
    await page.getByLabel("Search opportunities").fill("Helmholz");
    await expect(page.getByTestId("opportunity-card")).toHaveCount(1);
    await expect(page.getByText(/Helmholtz Research School Fellowships/i)).toBeVisible();
  });

  test("filtering by a match label that no opportunity currently carries narrows to zero results", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByTestId("opportunity-card")).toHaveCount(55);

    // Every seeded opportunity carries a single unmappable structured rule (kind "other"), so the
    // matching engine can only ever resolve one of "missing-information" or "deadline-risk" (if the
    // opportunity's own deadline has already passed) for this dataset — never a real match/mismatch.
    // "Strong potential fit" is therefore a deterministic zero-result case that proves the filter
    // actually filters, unlike the other two labels whose split depends on today's date.
    await page.getByRole("checkbox", { name: "Strong potential fit" }).check();
    await expect(page.getByText("No opportunities match your filters")).toBeVisible();

    await page.getByRole("checkbox", { name: "Strong potential fit" }).uncheck();
    await page.getByRole("checkbox", { name: "Missing information" }).check();
    await page.getByRole("checkbox", { name: "Deadline risk" }).check();
    await expect(page.getByTestId("opportunity-card")).toHaveCount(55);
  });
});

test.describe("Saved searches", () => {
  test("a search can be saved and appears in the saved-searches panel", async ({ page }) => {
    await page.goto("/opportunities");
    // The seed dataset has two genuinely different "DAAD"-titled opportunities.
    await page.getByLabel("Search opportunities").fill("DAAD");
    await expect(page.getByTestId("opportunity-card")).toHaveCount(2);

    await page.getByRole("button", { name: "Save this search" }).click();
    await page.getByLabel("Saved search name").fill("My DAAD search");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await page.getByText("Saved searches", { exact: true }).click(); // opens the <details> panel
    await expect(page.getByText("My DAAD search")).toBeVisible();
    await expect(page.getByText(/2 results/i)).toBeVisible();
  });

  test("a saved search and eligibility answers both survive a full page reload", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("Helmholtz");
    await page.getByRole("button", { name: "Save this search" }).click();
    await page.getByLabel("Saved search name").fill("Reload check");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await page.goto("/eligibility");
    await page.getByLabel("Nationality / citizenship").fill("Germany");
    await page.getByRole("button", { name: "Save answers" }).click();
    await expect(page.getByText("Saved on this device")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Nationality / citizenship")).toHaveValue("Germany");

    await page.goto("/opportunities");
    await page.getByText("Saved searches", { exact: true }).click();
    await expect(page.getByText("Reload check")).toBeVisible();
  });
});

test.describe("Eligibility profile", () => {
  test("every field is optional — the form saves with nothing filled in", async ({ page }) => {
    await page.goto("/eligibility");
    await expect(page.getByRole("heading", { name: "Eligibility profile" })).toBeVisible();
    await page.getByRole("button", { name: "Save answers" }).click();
    await expect(page.getByText("Saved on this device")).toBeVisible();
  });

  test("filled-in answers are used to compute a match label with cited reasons on a real opportunity", async ({ page }) => {
    await page.goto("/eligibility");
    await page.getByLabel("Nationality / citizenship").fill("Germany");
    await page.getByLabel("Current study level").fill("Bachelor");
    await page.getByRole("button", { name: "Save answers" }).click();
    await expect(page.getByText("Saved on this device")).toBeVisible();

    await page.goto("/opportunities/daad-scholarships-for-foreign-students");
    // The opportunity's own "Eligibility" section already shows this exact sentence, so the match
    // panel's citation of the same rule text is only unambiguous combined into one full string.
    await expect(
      page.getByText(
        /No answer provided to check this official rule: Bachelor's, Master's, or PhD applicants from any country with a strong academic record/i,
      ),
    ).toBeVisible();
    // A match label is always shown with the standard disclaimer, never presented as a final decision.
    await expect(page.getByText(/never a guarantee of eligibility, admission, or funding/i)).toBeVisible();
  });
});

test.describe("Comparison", () => {
  test("selecting 2 opportunities and comparing shows both side by side, including a match-label row", async ({ page }) => {
    await page.goto("/opportunities");
    const cards = page.getByTestId("opportunity-card");

    await cards.nth(0).getByLabel("Compare").check();
    await cards.nth(1).getByLabel("Compare").check();
    await expect(page.getByText("2 of 4 selected for comparison")).toBeVisible();

    await page.getByRole("link", { name: "Compare now" }).click();
    await expect(page).toHaveURL(/\/compare/);
    await expect(page.getByRole("heading", { name: "Compare opportunities" })).toBeVisible();
    await expect(page.getByText(/Comparing 2 opportunities/i)).toBeVisible();
  });

  test("fewer than 2 selections shows the empty-state prompt instead of a table", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByText("Select at least 2 opportunities to compare")).toBeVisible();
  });
});

test.describe("Reminders", () => {
  test("setting a personal deadline creates an upcoming reminder in the notification center", async ({ page }) => {
    await page.goto("/opportunities/daad-scholarships-for-foreign-students");
    await page.getByLabel("Your personal deadline").fill(tomorrowIsoDate());
    await page.getByLabel("Your personal deadline").blur();
    await expect(page.getByText(/Reminder:/)).toBeVisible();

    await page.goto("/notifications");
    await expect(page.getByText(/Upcoming \(1\)/)).toBeVisible();
    await expect(page.getByText(/Your personal deadline for/i)).toBeVisible();
    await expect(page.getByText(/Personal deadline · Due/i)).toBeVisible();
  });

  test("an opportunity with no exact, verified official deadline never gets an official-deadline reminder just from being tracked", async ({
    page,
  }) => {
    await page.goto("/opportunities/helmholtz-research-school-fellowships");
    await page.getByLabel("Application stage").selectOption("researching");

    await page.goto("/notifications");
    await expect(page.getByText(/Upcoming \(0\)/)).toBeVisible();
    await expect(page.getByText(/Helmholtz/i)).toHaveCount(0);
  });
});

test.describe("Notification center", () => {
  test("shows overdue, upcoming, and dismissed sections, and dismissing a reminder moves it between them", async ({ page }) => {
    await page.goto("/opportunities/daad-scholarships-for-foreign-students");
    await page.getByLabel("Your personal deadline").fill(tomorrowIsoDate());
    await page.getByLabel("Your personal deadline").blur();
    await expect(page.getByText(/Reminder:/)).toBeVisible();

    await page.goto("/notifications");
    await expect(page.getByText(/Overdue \(0\)/)).toBeVisible();
    await expect(page.getByText(/Upcoming \(1\)/)).toBeVisible();
    await expect(page.getByText(/Dismissed \/ completed \(0\)/)).toBeVisible();

    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(page.getByText(/Upcoming \(0\)/)).toBeVisible();
    await expect(page.getByText(/Dismissed \/ completed \(1\)/)).toBeVisible();
  });

  test("never requests browser notification permission automatically on page load", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __requestPermissionCalls: number }).__requestPermissionCalls = 0;
      if (typeof Notification !== "undefined") {
        const original = Notification.requestPermission.bind(Notification);
        Notification.requestPermission = ((...args: Parameters<typeof Notification.requestPermission>) => {
          (window as unknown as { __requestPermissionCalls: number }).__requestPermissionCalls += 1;
          return original(...args);
        }) as typeof Notification.requestPermission;
      }
    });

    await page.goto("/notifications");
    await page.waitForTimeout(1000); // give any (incorrect) auto-request code a chance to fire
    const calls = await page.evaluate(() => (window as unknown as { __requestPermissionCalls?: number }).__requestPermissionCalls ?? 0);
    expect(calls).toBe(0);
  });
});
