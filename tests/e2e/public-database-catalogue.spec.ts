import { expect, test } from "./fixtures";

test.describe("Database-backed public catalogue", () => {
  test("/api/health reports checkpoint 2 and a configured database", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.checkpoint).toBe(2);
    expect(body.databaseConfigured).toBe(true);
    expect(typeof body.publishedOpportunityCount).toBe("number");
  });

  test("/api/opportunities returns only published records with a syncedAt timestamp", async ({ request }) => {
    const response = await request.get("/api/opportunities");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(typeof body.syncedAt).toBe("string");
    expect(Array.isArray(body.opportunities)).toBe(true);
    for (const opportunity of body.opportunities) {
      expect(opportunity.kind).toBe("built-in");
      expect(opportunity.verification).toBeTruthy();
    }
  });

  test("the catalogue page count matches the API's published count exactly (no draft leakage)", async ({ page, request }) => {
    const health = await (await request.get("/api/health")).json();
    await page.goto("/opportunities");
    await expect(page.getByTestId("opportunity-card")).toHaveCount(health.publishedOpportunityCount);
  });

  test("a published opportunity's detail page shows deadline and verification as visually separate sections", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");
    await page.getByRole("link", { name: /View details/i }).first().click();

    await expect(page.getByRole("heading", { name: "Deadline" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verification" })).toBeVisible();
    await expect(page.getByText(/not yet verified by staff|verified by staff/i)).toBeVisible();
  });

  test("a published opportunity's detail page offers a correction-report action", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");
    await page.getByRole("link", { name: /View details/i }).first().click();
    await expect(page.getByRole("button", { name: /report incorrect information/i })).toBeVisible();
  });
});
