import { expect, test } from "./fixtures";

test.describe("Custom opportunities", () => {
  test("a custom opportunity can be created with a full set of fields", async ({ page }) => {
    await page.goto("/custom-opportunities/new");

    await page.getByLabel("Title").fill("Community Leadership Grant");
    await page.getByLabel("Countries (comma-separated)").fill("Poland");
    await page.getByRole("checkbox", { name: "Bachelor" }).check();
    await page.getByLabel("Benefit / funding summary").fill("A one-time EUR 1000 grant.");
    await page.getByLabel("Eligibility summary").fill("Undergraduate students with a community project.");
    await page.getByLabel("Official URL (optional)").fill("https://example.invalid/grant");
    await page.getByLabel("Deadline type").selectOption("exact");
    await page.getByLabel("Calendar date").fill("2027-06-01");
    await page.getByLabel("Original deadline wording").fill("Applications close 1 June 2027");

    await page.getByRole("button", { name: "Create opportunity" }).click();
    await expect(page).toHaveURL(/\/opportunities\/community-leadership-grant/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Community Leadership Grant");
    // OpportunityDetailBody renders VerificationBadge twice (a compact mobile
    // layout and a desktop sidebar layout, toggled via responsive CSS, both
    // present in the DOM at once) — scope to the first match rather than an
    // unqualified getByText, which is ambiguous (Playwright strict mode).
    // The badge shows the short label; the full sentence moved to its `title`
    // (see VERIFICATION_PRESETS in badges.tsx). Assert both so this still fails
    // if the long-form explanation is dropped rather than just relocated.
    const selfAdded = page.getByText("Self-added").first();
    await expect(selfAdded).toBeVisible();
    await expect(page.locator('[title="Self-reported custom opportunity — not officially verified."]').first()).toBeAttached();
  });

  test("invalid custom opportunity input shows field-level errors and blocks submission", async ({ page }) => {
    await page.goto("/custom-opportunities/new");
    await page.getByLabel("Official URL (optional)").fill("not-a-valid-url");
    await page.getByRole("button", { name: "Create opportunity" }).click();
    await expect(page.getByText(/valid URL/i)).toBeVisible();
    await expect(page).toHaveURL(/\/custom-opportunities\/new/);
  });

  test("editing preserves tracking state and deleting requires confirmation", async ({ page }) => {
    await page.goto("/custom-opportunities/new");
    await page.getByLabel("Title").fill("Editable Award");
    await page.getByLabel("Countries (comma-separated)").fill("Italy");
    await page.getByRole("checkbox", { name: "Master" }).check();
    await page.getByLabel("Benefit / funding summary").fill("Tuition waiver");
    await page.getByLabel("Eligibility summary").fill("Open to all");
    await page.getByLabel("Deadline type").selectOption("unknown");
    await page.getByLabel("Original deadline wording").fill("Not yet announced");
    await page.getByRole("button", { name: "Create opportunity" }).click();
    await expect(page).toHaveURL(/\/opportunities\/editable-award/);

    // Shortlist it before editing (the detail page's tracking panel uses a
    // simple "Add to shortlist" label since the opportunity title is already
    // the page heading).
    await page.getByRole("button", { name: "Add to shortlist" }).click();

    const editUrlMatch = await page.evaluate(async () => {
      const dbRequest = indexedDB.open("scholartrack");
      return new Promise((resolve) => {
        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          const tx = db.transaction("customOpportunities", "readonly");
          const store = tx.objectStore("customOpportunities");
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            const record = (getAllRequest.result as { id: string; slug: string }[]).find(
              (r) => r.slug === "editable-award",
            );
            resolve(record?.id ?? null);
          };
        };
      });
    });
    expect(editUrlMatch).toBeTruthy();

    await page.goto(`/custom-opportunities/${editUrlMatch}/edit`);
    await expect(page.getByLabel("Title")).toHaveValue("Editable Award");
    await page.getByLabel("Title").fill("Editable Award (Updated)");
    await page.getByRole("button", { name: "Save changes" }).click();
    // Editing the title regenerates the slug, and the redirect can take a
    // moment on a cold production build; allow a generous timeout.
    await expect(page).toHaveURL(/\/opportunities\/editable-award/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Editable Award (Updated)");

    // Tracking state (shortlist) should have been preserved through the edit.
    await expect(page.getByRole("button", { name: "Shortlisted" })).toBeVisible();

    // Deletion requires an explicit confirmation dialog.
    await page.goto(`/custom-opportunities/${editUrlMatch}/edit`);
    await page.getByRole("button", { name: /delete this custom opportunity/i }).click();
    await expect(page.getByRole("dialog", { name: /delete custom opportunity/i })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: /delete this custom opportunity/i }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace/);
  });
});
