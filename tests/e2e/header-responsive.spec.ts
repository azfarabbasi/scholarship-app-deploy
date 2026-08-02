import { expect, test } from "./fixtures";

/**
 * Phase 5 (launch-audit remediation): the header's nav switched to inline
 * mode at `md` (768px) while the Account/Staff-portal/theme-toggle cluster
 * switched at `sm` (640px) — two different breakpoints for what's meant to
 * be one "desktop mode." Between 768px and ~950px this didn't fit at all
 * (confirmed by measuring real bounding boxes with Playwright), overflowing
 * silently because the app sets `overflow-x: hidden` globally, which masks
 * the standard `document.documentElement.scrollWidth <= viewportWidth` check
 * every other responsive test in this suite relies on. A second, unrelated
 * bug compounded it: the Account/Staff-portal links combined `buttonClasses()`
 * (which always bakes in a bare `inline-flex`) with a bare `hidden` class via
 * `cn()`, which is plain clsx with no Tailwind conflict resolution — Tailwind
 * emits `.inline-flex` after `.hidden` in its generated CSS, so `inline-flex`
 * permanently won the cascade and these links were visible at every
 * viewport, including 320px, regardless of the responsive classes attached.
 *
 * These tests check real element bounding boxes (not scrollWidth, and not
 * accessibility-tree-based locators, which stop resolving a hidden element
 * entirely) so both bugs — and the "looks fine per scrollWidth but isn't"
 * failure mode — stay caught. Plain attribute selectors are used instead of
 * getByRole() specifically where a check needs to work on a HIDDEN element:
 * ARIA role queries exclude `display:none` nodes from the accessibility
 * tree, so getByRole() cannot even locate them to assert non-visibility.
 */

function isRendered(box: { width: number; height: number } | null) {
  return !!box && box.width > 0 && box.height > 0;
}

test.describe("Header responsive behavior", () => {
  test("below the lg breakpoint, the nav and account/staff/theme cluster are tucked behind the hamburger with no overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto("/");

    const header = page.locator("header");
    const primaryNav = header.locator('nav[aria-label="Primary"]');
    const accountLink = header.locator('a[href="/account"]');
    const staffLink = header.locator('a[href="/staff/login"]');
    const themeToggle = header.locator('[role="radiogroup"][aria-label="Theme"]');
    const hamburger = header.getByRole("button", { name: /open menu/i });

    await expect(hamburger).toBeVisible();
    expect(isRendered(await primaryNav.boundingBox())).toBe(false);
    expect(isRendered(await accountLink.boundingBox())).toBe(false);
    expect(isRendered(await staffLink.boundingBox())).toBe(false);
    expect(isRendered(await themeToggle.boundingBox())).toBe(false);

    const maxRight = await header.evaluate((el) => {
      const rects = Array.from(el.querySelectorAll("a, button, [role='radiogroup']"))
        .map((node) => node.getBoundingClientRect())
        .filter((r) => r.width > 0 || r.height > 0);
      return Math.max(...rects.map((r) => r.right));
    });
    expect(maxRight).toBeLessThanOrEqual(900);

    // The hamburger dropdown still gives access to everything hidden from the main row.
    await hamburger.click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile" });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Opportunities" })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: /account/i })).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: /staff portal/i })).toBeVisible();
    await expect(mobileNav.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
  });

  test("at the lg breakpoint, the full nav and an icon-only account/staff/theme cluster fit without overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.locator('nav[aria-label="Primary"]')).toBeVisible();
    await expect(header.getByRole("button", { name: /open menu/i })).toBeHidden();

    const accountLink = header.locator('a[href="/account"]');
    const staffLink = header.locator('a[href="/staff/login"]');
    await expect(accountLink).toBeVisible();
    await expect(staffLink).toBeVisible();

    const maxRight = await header.evaluate((el) => {
      const rects = Array.from(el.querySelectorAll("a, button, [role='radiogroup']"))
        .map((node) => node.getBoundingClientRect())
        .filter((r) => r.width > 0 || r.height > 0);
      return Math.max(...rects.map((r) => r.right));
    });
    expect(maxRight).toBeLessThanOrEqual(1024);

    // Icon-only at `lg` (narrow) — the full text label only reveals at `xl` (wider, next test).
    const accountBoxAtLg = await accountLink.boundingBox();
    expect(accountBoxAtLg?.width).toBeLessThan(60);
  });

  test("at the xl breakpoint, account and staff-portal show their full text label without wrapping", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto("/");

    const header = page.locator("header");
    const accountLink = header.locator('a[href="/account"]');
    const staffLink = header.locator('a[href="/staff/login"]');

    await expect(accountLink).toContainText("Account");
    await expect(staffLink).toContainText("Staff portal");

    // Wider than the icon-only box at `lg`, but a wrapped button (the original bug) reports a
    // taller box than a single text line — check both to rule out either failure mode.
    const accountBox = await accountLink.boundingBox();
    const staffBox = await staffLink.boundingBox();
    expect(accountBox?.width).toBeGreaterThan(60);
    expect(accountBox?.height).toBeLessThanOrEqual(40);
    expect(staffBox?.height).toBeLessThanOrEqual(40);
  });
});
