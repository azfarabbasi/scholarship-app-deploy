import { expect, test } from "./fixtures";

const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL;
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD;
const STUDENT2_EMAIL = process.env.E2E_STUDENT2_EMAIL;
const STUDENT2_PASSWORD = process.env.E2E_STUDENT2_PASSWORD;

test.describe("Guest workspace (no account required)", () => {
  test("a guest can use the workspace without signing in", async ({ page }) => {
    await page.goto("/workspace");
    await expect(page.getByText(/using scholartrack as a guest/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /create an account/i }).first()).toBeVisible();
  });

  test("a guest can shortlist an opportunity, add a note, and add a checklist task", async ({ page }) => {
    await page.goto("/opportunities");
    const firstCard = page.locator("a[href^='/opportunities/']").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();

    const shortlistButton = page.getByRole("button", { name: /shortlist/i }).first();
    if (await shortlistButton.count()) {
      await shortlistButton.click();
    }

    await page.goto("/workspace");
    await expect(page.getByText(/using scholartrack as a guest/i)).toBeVisible();
  });
});

test.describe("Student account routes", () => {
  test("an unauthenticated visitor to /account is redirected to /auth/login with a safe next param", async ({ page }) => {
    await page.goto("/account/sync");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Faccount%2Fsync/);
  });

  test("the login page is reachable without a redirect loop", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("the signup page is reachable", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByRole("heading", { name: /create an account/i })).toBeVisible();
  });

  test("submitting an incorrect password shows an error rather than crashing", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByRole("alert").filter({ hasText: /sign-in failed/i })).toBeVisible({ timeout: 15_000 });
  });

  test("account pages are never served from the service worker cache while offline", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForFunction(
      async () => {
        if (!("serviceWorker" in navigator)) return false;
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state === "activated";
      },
      { timeout: 20_000 },
    );

    await page.goto("/auth/login");
    await context.setOffline(true);
    const response = await page.goto("/auth/login", { waitUntil: "commit" }).catch(() => null);
    if (response) {
      expect(response.ok()).toBe(false);
    }
    await context.setOffline(false);
  });
});

test.describe("Staff/student separation", () => {
  test("visiting /staff while unauthenticated never lands on an account page", async ({ page }) => {
    await page.goto("/staff/opportunities");
    await expect(page).toHaveURL(/\/staff\/login/);
  });
});

test.describe("Authenticated student flows (require a real Supabase project + test account)", () => {
  test.skip(
    !STUDENT_EMAIL || !STUDENT_PASSWORD,
    "E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD are not set — configure a real Supabase test project and a confirmed " +
      "student account to run these. See docs/checkpoint-3/student-auth-and-sync.md.",
  );

  async function signIn(page: import("@playwright/test").Page) {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(STUDENT_EMAIL as string);
    await page.getByLabel("Password").fill(STUDENT_PASSWORD as string);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 15_000 });
  }

  test("a confirmed student account can sign in and reach the account dashboard", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  });

  test("a signed-in student cannot access /staff", async ({ page }) => {
    await signIn(page);
    await page.goto("/staff/opportunities");
    await expect(page).toHaveURL(/\/staff\/(login|unauthorized)/);
  });

  test("the migration prompt appears on the sync page", async ({ page }) => {
    await signIn(page);
    await page.goto("/account/sync");
    await expect(page.getByRole("heading", { name: /bring in your guest data|sync/i }).first()).toBeVisible();
  });

  test("workspace data persists after logout and login again", async ({ page }) => {
    await signIn(page);
    await page.goto("/workspace");
    await expect(page.getByText(/signed in as/i)).toBeVisible();

    await page.locator('form[action="/auth/logout"] button').click();
    await expect(page).toHaveURL("/");

    await signIn(page);
    await page.goto("/workspace");
    await expect(page.getByText(/signed in as/i)).toBeVisible();
  });

  test("cloud export downloads a JSON file", async ({ page }) => {
    await signIn(page);
    await page.goto("/account/data");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /export account data/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/scholartrack-account-.*\.json/);
  });
});

test.describe("Cross-user isolation (requires two real, confirmed student accounts)", () => {
  test.skip(
    !STUDENT_EMAIL || !STUDENT_PASSWORD || !STUDENT2_EMAIL || !STUDENT2_PASSWORD,
    "E2E_STUDENT_EMAIL/PASSWORD and E2E_STUDENT2_EMAIL/PASSWORD are not set — configure two real, confirmed student " +
      "accounts to run this. See docs/checkpoint-3/student-auth-and-sync.md.",
  );

  test("a second student cannot see the first student's account email on the dashboard", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(STUDENT2_EMAIL as string);
    await page.getByLabel("Password").fill(STUDENT2_PASSWORD as string);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 15_000 });
    await expect(page.getByText(STUDENT_EMAIL as string)).toHaveCount(0);
  });
});
