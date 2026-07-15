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
});
