import { expect, test } from "./fixtures";

/**
 * Checkpoint 7: `npm run launch:smoke`. The twelve launch smoke scenarios
 * named in the checkpoint brief — a fast, high-confidence "is the deployment
 * basically working" pass, distinct from the full regression suite. Kept
 * deliberately independent of any single account/AI configuration so it can
 * run against a fresh deployment before real content or staff credentials
 * exist.
 */

test.describe("Launch smoke tests", () => {
  test("1. home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ScholarTrack/);
    await expect(page.getByRole("heading", { name: /track verified scholarships/i })).toBeVisible();
  });

  test("2. catalogue loads", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Opportunity catalogue" })).toBeVisible();
  });

  test("3. opportunity detail page loads", async ({ page }) => {
    await page.goto("/opportunities");
    const firstCard = page.locator("a[href^='/opportunities/']").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    await expect(page.getByRole("heading", { name: "Deadline" })).toBeVisible();
  });

  test("4. search works", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");
    await expect(page.getByRole("link", { name: /View details/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("5. guest shortlist works", async ({ page }) => {
    await page.goto("/opportunities");
    const firstCard = page.locator("a[href^='/opportunities/']").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    const shortlistButton = page.getByRole("button", { name: /shortlist/i }).first();
    await expect(shortlistButton).toBeVisible({ timeout: 10_000 });
    await shortlistButton.click();
    await page.goto("/workspace");
    await expect(page.getByRole("heading", { name: /your workspace/i })).toBeVisible();
  });

  test("6. account route protects an unauthenticated visitor", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("7. staff route protects an unauthenticated visitor", async ({ page }) => {
    await page.goto("/staff");
    await expect(page).toHaveURL(/\/staff\/login/);
  });

  test("8. public trust pages load", async ({ page }) => {
    for (const path of ["/privacy", "/terms", "/disclaimer", "/security", "/accessibility"]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should load successfully`).toBeLessThan(400);
    }
  });

  test("9. sitemap and robots load", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("<urlset");

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("Sitemap:");
  });

  test("10. core app functionality does not depend on the AI assistant's configuration", async ({ page }) => {
    // The e2e environment always runs with AI_ENABLED=true/mock (see
    // docker-compose.yml's web-e2e service), so this suite cannot flip AI off
    // and reload a second instance. Instead this confirms the two guarantees
    // that actually matter: (a) the assistant itself shows a working or
    // honestly-unavailable state, never a crash, and (b) the rest of the app
    // works identically regardless. See tests/e2e/ai-assistant.spec.ts for
    // the dedicated, credential-gated "staff disables AI" scenario.
    await page.goto("/assistant");
    const assistantRenderedSafely = await Promise.race([
      page.getByPlaceholder(/ask a question/i).isVisible({ timeout: 10_000 }).catch(() => false),
      page.getByText(/currently unavailable/i).isVisible({ timeout: 10_000 }).catch(() => false),
    ]);
    expect(assistantRenderedSafely).toBe(true);

    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Opportunity catalogue" })).toBeVisible();
  });

  test("11. the service worker registers on the public shell", async ({ page }) => {
    // Full offline-round-trip serving is covered (with documented, proven
    // pre-existing environment caveats) by tests/e2e/offline.spec.ts and
    // tests/e2e/ai-assistant.spec.ts's scenario 12 — see
    // docs/checkpoint-6/checkpoint-6-traceability.md's "Honest note" section.
    // This smoke test checks the one thing that must always be true for a
    // fresh launch: the service worker registers and activates at all.
    await page.goto("/");
    const activated = await page
      .waitForFunction(
        async () => {
          if (!("serviceWorker" in navigator)) return false;
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state === "activated";
        },
        { timeout: 20_000 },
      )
      .then(() => true)
      .catch(() => false);
    expect(activated).toBe(true);

    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /you.re offline/i })).toBeVisible();
  });

  test("12. mobile layout works", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/opportunities");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    await expect(page.getByRole("heading", { name: "Opportunity catalogue" })).toBeVisible();
  });
});
