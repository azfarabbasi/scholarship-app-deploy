import { expect, test } from "./fixtures";

test.describe("Theme", () => {
  test("switching to dark mode updates the document and persists after reload", async ({ page }) => {
    await page.goto("/settings");

    await page.getByRole("main").getByRole("radio", { name: /dark theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("main").getByRole("radio", { name: /dark theme/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("switching to light mode works and is distinguishable from dark", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("main").getByRole("radio", { name: /light theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
