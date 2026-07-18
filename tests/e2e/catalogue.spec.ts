import { expect, test } from "./fixtures";

test.describe("Catalogue", () => {
  test("loads with exactly 55 built-in opportunities", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Opportunity catalogue" })).toBeVisible();
    await expect(page.getByTestId("opportunity-card")).toHaveCount(55);
  });

  test("search narrows results and combined filters work together", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByTestId("opportunity-card")).toHaveCount(55);

    await page.getByLabel("Search opportunities").fill("Helmholtz");
    await expect(page.getByTestId("opportunity-card")).toHaveCount(1);
    await expect(page.getByText(/1 opportunity found/i)).toBeVisible();

    await page.getByLabel("Search opportunities").fill("");
    await expect(page.getByTestId("opportunity-card")).toHaveCount(55);

    // Country/study-level filters live behind the collapsed "More filters" disclosure.
    await page.getByText("More filters").click();
    await page.getByRole("checkbox", { name: "Germany" }).check();
    const afterCountry = await page.getByTestId("opportunity-card").count();
    expect(afterCountry).toBeGreaterThan(0);
    expect(afterCountry).toBeLessThan(55);

    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page.getByTestId("opportunity-card")).toHaveCount(55);
  });

  test("a no-results search shows a helpful empty state with a reset action", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("this-will-not-match-anything-xyz");
    await expect(page.getByText("No opportunities match your filters")).toBeVisible();
    await page.getByRole("button", { name: "Reset all filters" }).click();
    await expect(page.getByTestId("opportunity-card")).toHaveCount(55);
  });

  test("opening a detail page shows title, deadline status, and guest tracking controls", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");
    await page.getByRole("link", { name: /View details/i }).first().click();

    await expect(page).toHaveURL(/\/opportunities\/daad-scholarships-for-foreign-students/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("DAAD");
    await expect(page.getByRole("heading", { name: "Deadline" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your tracking" })).toBeVisible();
  });
});
