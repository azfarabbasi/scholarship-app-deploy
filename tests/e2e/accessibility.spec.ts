import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

const PAGES = [
  "/",
  "/opportunities",
  "/opportunities/daad-scholarships-for-foreign-students",
  "/workspace",
  "/calendar",
  "/settings",
  "/privacy",
  "/offline",
  "/custom-opportunities/new",
  // Checkpoint 6: the AI assistant, account/staff entry points, and a
  // representative sample of the new static content pages (not all twelve,
  // to keep this suite's runtime reasonable — they share one layout/styling
  // system, so a handful is a meaningful sample of the rest).
  "/assistant",
  "/auth/login",
  "/staff/login",
  "/about",
  "/faq",
  "/terms",
  "/accessibility",
];

test.describe("Accessibility (axe-core)", () => {
  for (const path of PAGES) {
    test(`${path} has no critical or serious axe violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      const seriousOrCritical = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );

      expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
    });
  }

  test("the skip link is the first tab stop and moves focus into main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("respects prefers-reduced-motion and still renders the homepage correctly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /track verified scholarships/i })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const seriousOrCritical = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
  });

  test("focus returns to the trigger button after closing the correction-report dialog", async ({ page }) => {
    await page.goto("/opportunities/daad-scholarships-for-foreign-students");
    const triggerButton = page.getByRole("button", { name: /report incorrect information/i });
    await expect(triggerButton).toBeVisible({ timeout: 15_000 });
    await triggerButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(triggerButton).toBeFocused();
  });
});
