import { expect, test } from "./fixtures";

test.describe("Offline behaviour", () => {
  test("the core shell remains available offline after an initial online visit", async ({ page, context }) => {
    await page.goto("/");

    await page.waitForFunction(
      async () => {
        if (!("serviceWorker" in navigator)) return false;
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state === "activated";
      },
      { timeout: 20_000 },
    );

    // Visit the main routes once online so the app shell and their data get cached.
    await page.goto("/opportunities");
    await page.goto("/workspace");
    await page.goto("/calendar");
    await page.goto("/settings");

    await context.setOffline(true);

    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Opportunity catalogue" })).toBeVisible();
    await expect(page.getByTestId("opportunity-card").first()).toBeVisible();

    await page.goto("/workspace");
    await expect(page.getByRole("heading", { name: "Your workspace" })).toBeVisible();

    await context.setOffline(false);
  });

  test("the offline fallback page renders useful guidance", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /you.re offline/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /try the catalogue/i })).toBeVisible();
  });
});
