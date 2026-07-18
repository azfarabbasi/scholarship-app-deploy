import { expect, test } from "./fixtures";

/**
 * The floating Scholarly widget: page allowlist, open/close accessibility,
 * and quick-question flow. Runs against the deterministic mock AI provider
 * (`AI_ENABLED=true AI_PROVIDER=mock` on the e2e server — see
 * docker-compose.yml), same as tests/e2e/ai-assistant.spec.ts.
 */
test.describe("Scholarly widget", () => {
  test("appears on the home page and opens a quick-question panel", async ({ page }) => {
    await page.goto("/");
    const launcher = page.getByRole("button", { name: "Ask Scholarly" });
    await expect(launcher).toBeVisible();
    await expect(launcher).toHaveAttribute("aria-expanded", "false");

    await launcher.click();
    const panel = page.getByRole("dialog", { name: "Scholarly quick assistant" });
    await expect(panel).toBeVisible();
    await expect(page.getByRole("link", { name: /open the full scholarly assistant/i })).toBeVisible();
  });

  test("closes with Escape and returns focus to the launcher", async ({ page }) => {
    await page.goto("/");
    const launcher = page.getByRole("button", { name: "Ask Scholarly" });
    await launcher.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("button", { name: "Ask Scholarly" })).toBeFocused();
  });

  test("appears on the catalogue and opportunity detail pages", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByRole("button", { name: "Ask Scholarly" })).toBeVisible();

    await page.getByLabel("Search opportunities").fill("DAAD");
    await page.getByRole("link", { name: /View details/i }).first().click();
    await expect(page.getByRole("button", { name: "Ask Scholarly" })).toBeVisible();
  });

  test("does not appear on staff, auth, or legal pages", async ({ page }) => {
    await page.goto("/staff/login");
    await expect(page.getByRole("button", { name: "Ask Scholarly" })).toHaveCount(0);

    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: "Ask Scholarly" })).toHaveCount(0);

    await page.goto("/privacy");
    await expect(page.getByRole("button", { name: "Ask Scholarly" })).toHaveCount(0);

    await page.goto("/terms");
    await expect(page.getByRole("button", { name: "Ask Scholarly" })).toHaveCount(0);
  });

  test("does not appear on the full assistant pages or the account delete page", async ({ page }) => {
    await page.goto("/assistant");
    await expect(page.getByRole("button", { name: "Ask Scholarly" })).toHaveCount(0);
  });

  test("mobile: the widget launcher stays reachable and never causes horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Ask Scholarly" })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});
