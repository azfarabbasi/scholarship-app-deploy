import { expect, test } from "./fixtures";

test.describe("Backup and restore", () => {
  test("a backup can be exported and a valid backup can be imported", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");
    await page.getByRole("button", { name: /add .* to shortlist/i }).first().click();

    await page.goto("/settings");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /export full backup/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/scholartrack-backup-.*\.json/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const contents = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    expect(contents.app).toBe("scholartrack");
    expect(contents.data.workspace.length).toBeGreaterThan(0);

    // Now clear local data and import the backup back in "replace" mode.
    await page.getByRole("button", { name: /clear all local data/i }).click();
    await page.getByRole("button", { name: "Clear everything" }).click();

    const fileInput = page.getByLabel(/choose a backup file/i);
    await fileInput.setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(contents)),
    });

    await expect(page.getByText(/backup summary/i)).toBeVisible();
    await page.getByLabel("Import mode").selectOption("replace");
    await page.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByText(/import complete/i)).toBeVisible();

    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");
    await expect(
      page.getByTestId("opportunity-card").first().getByRole("button", { name: /remove .* from shortlist/i }),
    ).toBeVisible();
  });

  test("an invalid backup file is rejected with a clear error", async ({ page }) => {
    await page.goto("/settings");
    const fileInput = page.getByLabel(/choose a backup file/i);
    await fileInput.setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from("{not valid json"),
    });
    await expect(page.getByText(/not valid json/i)).toBeVisible();
  });
});
