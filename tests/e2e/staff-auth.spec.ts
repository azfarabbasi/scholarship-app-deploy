import { expect, test } from "./fixtures";

const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;

test.describe("Staff authentication and route protection", () => {
  test("an unauthenticated visitor to /staff is redirected to /staff/login with a safe next param", async ({ page }) => {
    await page.goto("/staff/opportunities");
    await expect(page).toHaveURL(/\/staff\/login\?next=%2Fstaff%2Fopportunities/);
    await expect(page.getByRole("heading", { name: "Staff sign-in" })).toBeVisible();
  });

  test("the login page itself is reachable without a redirect loop", async ({ page }) => {
    await page.goto("/staff/login");
    await expect(page).toHaveURL(/\/staff\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("the unauthorized page is reachable without requiring a session", async ({ page }) => {
    await page.goto("/staff/unauthorized");
    await expect(page.getByText(/no staff access/i)).toBeVisible();
  });

  test("submitting an incorrect password shows an error rather than crashing", async ({ page }) => {
    await page.goto("/staff/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Next.js's own route announcer also carries role="alert", so scope to
    // our own error message rather than matching the role alone.
    await expect(page.getByRole("alert").filter({ hasText: /sign-in failed/i })).toBeVisible({ timeout: 15_000 });
  });

  test("staff pages are never served from the service worker cache while offline", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForFunction(
      async () => {
        if (!("serviceWorker" in navigator)) return false;
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state === "activated";
      },
      { timeout: 20_000 },
    );

    // Visit a staff page online first — if the service worker mistakenly
    // cached it, this would otherwise "succeed" offline below.
    await page.goto("/staff/login");

    await context.setOffline(true);
    const response = await page.goto("/staff/login", { waitUntil: "commit" }).catch(() => null);
    // Either the navigation fails outright, or the browser's own offline
    // dino/error page loads — never a cached, seemingly-successful staff page.
    if (response) {
      expect(response.ok()).toBe(false);
    }
    await context.setOffline(false);
  });

  test.describe("authenticated staff flows (require a real Supabase project + staff account)", () => {
    test.skip(
      !STAFF_EMAIL || !STAFF_PASSWORD,
      "E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD are not set — configure a real Supabase test project and a bootstrapped " +
        "staff account to run these. See docs/checkpoint-2/supabase-setup.md.",
    );

    test("a bootstrapped staff account can sign in and reach the dashboard", async ({ page }) => {
      await page.goto("/staff/login");
      await page.getByLabel("Email").fill(STAFF_EMAIL as string);
      await page.getByLabel("Password").fill(STAFF_PASSWORD as string);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/staff$/, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "Staff dashboard" })).toBeVisible();
    });

    test("a signed-in staff member can create a draft, submit it for review, and see it in the queue", async ({ page }) => {
      await page.goto("/staff/login");
      await page.getByLabel("Email").fill(STAFF_EMAIL as string);
      await page.getByLabel("Password").fill(STAFF_PASSWORD as string);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/staff$/, { timeout: 15_000 });

      await page.goto("/staff/opportunities/new");
      await page.getByLabel("Title").fill(`E2E Test Draft ${Date.now()}`);
      await page.getByLabel("Summary").fill("Created by the Playwright e2e suite.");
      await page.getByRole("button", { name: "Create draft" }).click();
      await expect(page).toHaveURL(/\/staff\/opportunities\/[0-9a-f-]+$/, { timeout: 15_000 });

      await page.getByRole("button", { name: "Submit for review" }).click();
      await expect(page.getByText(/in_review/i)).toBeVisible();
    });
  });
});
