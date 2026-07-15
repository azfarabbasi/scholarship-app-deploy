import { expect, test } from "./fixtures";

test.describe("Guest workspace tracking", () => {
  test("an opportunity can be shortlisted from the catalogue, and it persists after reload", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");

    const card = page.getByTestId("opportunity-card").first();
    const shortlistButton = card.getByRole("button", { name: /add .* to shortlist/i });
    await shortlistButton.click();
    await expect(card.getByRole("button", { name: /remove .* from shortlist/i })).toBeVisible();

    await page.reload();
    await page.getByLabel("Search opportunities").fill("DAAD");
    await expect(
      page.getByTestId("opportunity-card").first().getByRole("button", { name: /remove .* from shortlist/i }),
    ).toBeVisible();
  });

  test("a stage, note, checklist item, and personal deadline can all be saved on the detail page", async ({
    page,
  }) => {
    await page.goto("/opportunities/daad-scholarships-for-foreign-students");

    await page.getByLabel("Application stage").selectOption("researching");

    await page.getByLabel("Notes").fill("Reached out to the programme coordinator.");
    await page.getByLabel("Notes").blur();
    await expect(page.getByText("Notes saved")).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/Add a checklist task/i).fill("Draft motivation letter");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Draft motivation letter")).toBeVisible();

    await page.getByLabel("Your personal deadline").fill("2027-05-01");
    await page.getByLabel("Your personal deadline").blur();
    await expect(page.getByText(/Reminder:/)).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Application stage")).toHaveValue("researching");
    await expect(page.getByText("Draft motivation letter")).toBeVisible();
    await expect(page.getByLabel("Your personal deadline")).toHaveValue("2027-05-01");
  });

  test("workspace displays tracked built-in opportunities and custom opportunities together", async ({ page }) => {
    await page.goto("/opportunities/daad-scholarships-for-foreign-students");
    await page.getByLabel("Application stage").selectOption("preparing");

    await page.goto("/custom-opportunities/new");
    await page.getByLabel("Title").fill("My Local Award");
    await page.getByLabel("Countries (comma-separated)").fill("Spain");
    await page.getByRole("checkbox", { name: "Master" }).check();
    await page.getByLabel("Benefit / funding summary").fill("Covers travel costs");
    await page.getByLabel("Eligibility summary").fill("Open to graduate students");
    await page.getByLabel("Original deadline wording").fill("Rolling admissions");
    await page.getByLabel("Deadline type").selectOption("rolling");
    await page.getByRole("button", { name: "Create opportunity" }).click();
    await expect(page).toHaveURL(/\/opportunities\/my-local-award/);

    await page.goto("/workspace");
    await expect(page.getByText("DAAD Scholarships for Foreign Students")).toBeVisible();
    await expect(page.getByText("My Local Award")).toBeVisible();
  });
});
