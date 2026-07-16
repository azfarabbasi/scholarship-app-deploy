import { expect, test } from "./fixtures";

test.describe("Public correction reports", () => {
  test("a guest can report incorrect information without signing in, and gets a generic success message", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");
    await page.getByRole("link", { name: /View details/i }).first().click();

    await page.getByRole("button", { name: /report incorrect information/i }).click();
    await expect(page.getByRole("heading", { name: /report incorrect information/i })).toBeVisible();

    await page.getByLabel(/what.s wrong/i).selectOption("incorrect-deadline");
    await page.getByLabel("Details").fill("The deadline shown here does not match the official page as of today.");
    await page.getByRole("button", { name: "Submit report" }).click();

    await expect(page.getByText(/thanks.*submitted for review/i)).toBeVisible({ timeout: 10_000 });
  });

  test("a description that is too short is rejected client-side before submission", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");
    await page.getByRole("link", { name: /View details/i }).first().click();
    await page.getByRole("button", { name: /report incorrect information/i }).click();

    const description = page.getByLabel("Details");
    await description.fill("short");
    const isValid = await description.evaluate((el: HTMLTextAreaElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test("the API rejects a malformed correction report directly (defense in depth beyond the UI)", async ({ request }) => {
    const response = await request.post("/api/correction-reports", {
      data: { opportunityId: "not-a-uuid", category: "incorrect-deadline", description: "too short" },
    });
    expect(response.status()).toBe(400);
  });
});
