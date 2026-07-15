import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LiveAnnouncerProvider } from "@/components/common/LiveAnnouncer";
import { BackupSection } from "@/components/settings/BackupSection";
import { DB_NAME, resetDbConnectionForTests } from "@/lib/storage/db";

async function resetDatabase() {
  await resetDbConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

beforeEach(resetDatabase);
afterEach(resetDatabase);

function renderBackupSection() {
  return render(
    <LiveAnnouncerProvider>
      <BackupSection />
    </LiveAnnouncerProvider>,
  );
}

describe("BackupSection import error handling", () => {
  it("rejects a file that is not valid JSON", async () => {
    const user = userEvent.setup();
    renderBackupSection();

    const input = screen.getByLabelText(/choose a backup file/i, { selector: "input" });
    const badFile = new File(["not json at all"], "backup.json", { type: "application/json" });
    await user.upload(input, badFile);

    expect(await screen.findByText(/not valid json/i)).toBeInTheDocument();
  });

  it("rejects a JSON file that does not match the backup schema", async () => {
    const user = userEvent.setup();
    renderBackupSection();

    const input = screen.getByLabelText(/choose a backup file/i, { selector: "input" });
    const badFile = new File([JSON.stringify({ hello: "world" })], "backup.json", { type: "application/json" });
    await user.upload(input, badFile);

    expect(await screen.findByText(/could not import this file/i)).toBeInTheDocument();
  });

  it("rejects an oversized file before attempting to parse it", async () => {
    const user = userEvent.setup();
    renderBackupSection();

    const input = screen.getByLabelText(/choose a backup file/i, { selector: "input" });
    const oversized = new File(["x".repeat(6 * 1024 * 1024)], "backup.json", { type: "application/json" });
    await user.upload(input, oversized);

    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
  });
});
