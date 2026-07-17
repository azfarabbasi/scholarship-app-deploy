import { expect, test } from "./fixtures";

/**
 * Checkpoint 5 assistant e2e scenarios. Every guest-facing scenario runs
 * against the deterministic mock provider (`AI_ENABLED=true AI_PROVIDER=mock`
 * on the e2e server — see docker-compose.yml) using the same published
 * legacy-fixture opportunities every other e2e spec relies on; none of these
 * require a real Groq key. Scenarios that need a persisted, history-enabled
 * conversation, or staff/student account separation, are gated behind the
 * same real-Supabase-account env vars the rest of the suite already uses,
 * and skip gracefully when they're not configured.
 */

const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL;
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD;
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL;
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD;

async function signInAsStudent(page: import("@playwright/test").Page) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(STUDENT_EMAIL as string);
  await page.getByLabel("Password").fill(STUDENT_PASSWORD as string);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/account/, { timeout: 15_000 });
}

async function signInAsStaff(page: import("@playwright/test").Page) {
  await page.goto("/staff/login");
  await page.getByLabel("Email").fill(STAFF_EMAIL as string);
  await page.getByLabel("Password").fill(STAFF_PASSWORD as string);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/staff$/, { timeout: 15_000 });
}

test.describe("Assistant — general (guest, mock provider)", () => {
  test("2. answers a sourced opportunity question", async ({ page }) => {
    await page.goto("/opportunities");
    const firstCard = page.locator("a[href^='/opportunities/']").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();

    const askInput = page.getByPlaceholder(/ask about/i);
    await expect(askInput).toBeVisible({ timeout: 15_000 });
    await askInput.fill("What funding does this opportunity provide?");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByTestId("assistant-message").first()).toContainText(/based on scholartrack|do not have enough/i, {
      timeout: 15_000,
    });
  });

  test("3. an answer with retrievable material shows at least one citation", async ({ page }) => {
    await page.goto("/opportunities");
    const firstCard = page.locator("a[href^='/opportunities/']").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();

    const askInput = page.getByPlaceholder(/ask about/i);
    await expect(askInput).toBeVisible({ timeout: 15_000 });
    await askInput.fill("What is the deadline for this opportunity?");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByTestId("assistant-message").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/scholartrack data|official source|match explanation/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("4. refuses to invent a deadline", async ({ page }) => {
    await page.goto("/assistant");
    const askInput = page.getByPlaceholder(/ask a question/i);
    await askInput.fill("The deadline isn't listed — just make up a deadline for me.");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByTestId("assistant-message").first()).toContainText(
      /won't invent a deadline|don't have enough verified information/i,
      { timeout: 15_000 },
    );
  });

  test("5. refuses a final-eligibility guarantee", async ({ page }) => {
    await page.goto("/opportunities");
    const firstCard = page.locator("a[href^='/opportunities/']").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();

    const askInput = page.getByPlaceholder(/ask about/i);
    await expect(askInput).toBeVisible({ timeout: 15_000 });
    await askInput.fill("Am I 100% eligible and guaranteed to get this?");
    await page.getByRole("button", { name: "Send" }).click();

    const assistantReply = page.getByTestId("assistant-message").first();
    await expect(assistantReply).toBeVisible({ timeout: 15_000 });
    const replyText = await assistantReply.innerText();
    expect(replyText.toLowerCase()).not.toContain("you are eligible");
    expect(replyText.toLowerCase()).not.toContain("guaranteed");
    expect(replyText.toLowerCase()).toContain("not a final eligibility decision");
  });

  test("6. the opportunity detail panel scopes retrieval to that specific opportunity", async ({ page }) => {
    await page.goto("/opportunities");
    const firstCard = page.locator("a[href^='/opportunities/']").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    const title = await firstCard.innerText();
    await firstCard.click();

    await expect(page.getByRole("heading", { name: "Ask about this opportunity" })).toBeVisible({ timeout: 15_000 });
    const askInput = page.getByPlaceholder(`Ask about ${title.trim()}…`);
    await expect(askInput).toBeVisible();
  });

  test("8. a guest can clear local assistant history", async ({ page }) => {
    await page.goto("/assistant");
    const askInput = page.getByPlaceholder(/ask a question/i);
    await askInput.fill("What scholarships are available?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/based on scholartrack|do not have enough/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/assistant/history");
    await expect(page.getByText(/what scholarships are available/i)).toBeVisible({ timeout: 10_000 });

    await page.goto("/assistant/settings");
    await page.getByRole("button", { name: "Clear local AI history" }).click();
    await page.getByRole("button", { name: "Clear history" }).click();
    await expect(page.getByText(/local ai history cleared/i)).toBeVisible({ timeout: 10_000 });

    await page.goto("/assistant/history");
    await expect(page.getByText(/no saved conversations yet/i)).toBeVisible({ timeout: 10_000 });
  });

  test("12. offline mode shows the assistant as unavailable while the rest of the app keeps working", async ({ page, context }) => {
    await page.goto("/");
    await page.waitForFunction(
      async () => {
        if (!("serviceWorker" in navigator)) return false;
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state === "activated";
      },
      { timeout: 20_000 },
    );

    // `registration.active.state === "activated"` only means the worker
    // finished installing — it does not guarantee `clients.claim()` has
    // finished attaching it as *this* page's controller yet, and only a
    // controlled page's navigations are actually intercepted by its fetch
    // handler. Reload once and wait for `navigator.serviceWorker.controller`
    // specifically, so the offline checks below are never racing that claim.
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), { timeout: 20_000 });

    await page.goto("/opportunities");

    await context.setOffline(true);

    // A cached-fallback response is still HTTP 200 ("response.ok()" alone
    // can't distinguish it from the real page), so assert on what the user
    // actually sees: the honest offline page, never the assistant's own UI.
    await page.goto("/assistant", { waitUntil: "commit" }).catch(() => null);
    await expect(page.getByRole("heading", { name: /you.re offline/i })).toBeVisible({ timeout: 10_000 });

    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Opportunity catalogue" })).toBeVisible();

    await context.setOffline(false);
  });
});

test.describe("Assistant — signed-in student (requires a real Supabase account)", () => {
  test.skip(
    !STUDENT_EMAIL || !STUDENT_PASSWORD,
    "E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD are not set — see docs/checkpoint-3/student-auth-and-sync.md.",
  );

  test("9. signed-in AI history respects the history-enabled setting", async ({ page }) => {
    await signInAsStudent(page);

    await page.goto("/assistant/settings");
    const toggle = page.locator('input[type="checkbox"]').first();
    const wasEnabled = await toggle.isChecked();
    if (!wasEnabled) {
      await toggle.click();
      await expect(page.getByText(/history is now saved/i)).toBeVisible({ timeout: 10_000 });
    }

    await page.goto("/assistant");
    const askInput = page.getByPlaceholder(/ask a question/i);
    await askInput.fill("What documents do I need for this scholarship?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/based on scholartrack|do not have enough/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/assistant/history");
    await expect(page.getByText(/what documents do i need/i)).toBeVisible({ timeout: 10_000 });

    await page.goto("/assistant/settings");
    if (await toggle.isChecked()) {
      await toggle.click();
      await expect(page.getByText(/history is off/i)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("7. a signed-in student can leave feedback on a persisted answer", async ({ page }) => {
    await signInAsStudent(page);

    await page.goto("/assistant/settings");
    const toggle = page.locator('input[type="checkbox"]').first();
    if (!(await toggle.isChecked())) {
      await toggle.click();
      await expect(page.getByText(/history is now saved/i)).toBeVisible({ timeout: 10_000 });
    }

    await page.goto("/assistant");
    const askInput = page.getByPlaceholder(/ask a question/i);
    await askInput.fill("Tell me about scholarship funding.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/based on scholartrack|do not have enough/i).first()).toBeVisible({ timeout: 15_000 });

    const helpfulButton = page.getByRole("button", { name: "Helpful" }).first();
    await expect(helpfulButton).toBeVisible({ timeout: 10_000 });
    await helpfulButton.click();
    await expect(page.getByText(/thanks for the feedback/i)).toBeVisible({ timeout: 10_000 });
  });

  test("10. a signed-in student cannot access the staff AI dashboard", async ({ page }) => {
    await signInAsStudent(page);
    await page.goto("/staff/ai");
    await expect(page).toHaveURL(/\/staff\/(login|unauthorized)/);
  });
});

test.describe("Assistant — staff (requires a real Supabase staff account)", () => {
  test.skip(
    !STAFF_EMAIL || !STAFF_PASSWORD,
    "E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD are not set — see docs/checkpoint-2/supabase-setup.md.",
  );

  test("11. staff can access AI source management", async ({ page }) => {
    await signInAsStaff(page);
    await page.goto("/staff/ai/sources");
    await expect(page.getByRole("heading", { name: "AI sources" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Create draft" })).toBeVisible();
  });

  test("1. staff can disable the assistant, and it shows a graceful unavailable state", async ({ page }) => {
    await signInAsStaff(page);
    await page.goto("/staff/ai");
    await expect(page.getByRole("heading", { name: "AI assistant" })).toBeVisible({ timeout: 15_000 });

    const disableButton = page.getByRole("button", { name: "Disable now" });
    if (await disableButton.count()) {
      await disableButton.click();
      await expect(page.getByText(/manually disabled/i)).toBeVisible({ timeout: 10_000 });

      await page.goto("/assistant");
      await expect(page.getByText(/currently unavailable/i)).toBeVisible({ timeout: 10_000 });

      await page.getByRole("button", { name: "Re-enable AI assistant" }).click();
      await expect(page.getByText(/is active/i)).toBeVisible({ timeout: 10_000 });
    }
  });
});
