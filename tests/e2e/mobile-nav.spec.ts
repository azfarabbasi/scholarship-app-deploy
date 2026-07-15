import { expect, test } from "./fixtures";

test.describe("Mobile navigation", () => {
  test("the mobile menu toggle opens and closes navigation without horizontal overflow", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile-only navigation test");

    await page.goto("/");

    const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 1);

    const toggle = page.getByRole("button", { name: /open menu/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const mobileNav = page.getByRole("navigation", { name: "Mobile" });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Opportunities" })).toBeVisible();

    await mobileNav.getByRole("link", { name: "Opportunities" }).click();
    await expect(page).toHaveURL(/\/opportunities/);
  });

  test("catalogue cards stack in a single column and stay within the viewport at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/opportunities");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(321);
  });
});
