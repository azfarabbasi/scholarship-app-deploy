"use client";

import { Download } from "lucide-react";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { downloadTextFile } from "@/lib/download";
import { exportMyData } from "@/lib/db/actions/student/data-controls";
import { importMyAccountData, type ImportResult } from "@/lib/db/actions/student/data-controls";
import { validateCloudExportPayload, MAX_CLOUD_IMPORT_FILE_SIZE_BYTES, type CloudImportValidationSuccess } from "@/lib/schemas/cloud-export";

function timestampSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function CloudDataSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pending, setPending] = useState<CloudImportValidationSuccess | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  async function handleExport() {
    setExporting(true);
    const payload = await exportMyData();
    setExporting(false);
    if (!payload) return;
    downloadTextFile(`scholartrack-account-${timestampSuffix()}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    setPending(null);
    setImportResult(null);
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_CLOUD_IMPORT_FILE_SIZE_BYTES) {
      setFileError(`File is too large (${Math.round(file.size / 1024)} KB). The maximum allowed is 5 MB.`);
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = validateCloudExportPayload(json);
      if (!result.valid) {
        setFileError(result.errors.join(" "));
        return;
      }
      setPending(result);
    } catch {
      setFileError("This file is not valid JSON.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!pending) return;
    const result = await importMyAccountData(pending.payload, importMode);
    setImportResult(result);
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Export your cloud data</h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Contains your profile, tracking state, notes, checklists, custom opportunities, preferences, eligibility
          answers, saved searches, reminders, and notifications — your own data only. Never includes your password,
          session tokens, cookies, or any staff/admin data.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void handleExport()} disabled={exporting}>
          <Download className="h-4 w-4" aria-hidden="true" /> {exporting ? "Preparing…" : "Export account data (JSON)"}
        </Button>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Import a previous export</h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Import a ScholarTrack account export file (JSON, up to 5 MB) into this account. This is for restoring your
          own cloud data — not for guest data (use{" "}
          <a href="/account/sync" className="underline">
            Sync &amp; migration
          </a>{" "}
          for that).
        </p>
        <div className="mt-3">
          <Label htmlFor="cloud-import-file" className="sr-only">
            Choose an account export file
          </Label>
          <input
            ref={fileInputRef}
            id="cloud-import-file"
            type="file"
            accept="application/json"
            onChange={(e) => void handleFileSelected(e)}
            className="block text-sm text-foreground-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          />
        </div>

        {fileError ? (
          <Alert tone="danger" title="Could not import this file" className="mt-3">
            {fileError}
          </Alert>
        ) : null}

        {importResult ? (
          <Alert tone={importResult.ok ? "success" : "danger"} className="mt-3">
            {importResult.ok
              ? `Imported ${importResult.trackingImported} tracked opportunities, ${importResult.notesImported} notes, ${importResult.checklistTasksImported} checklist tasks, ${importResult.customOpportunitiesImported} custom opportunities, ${importResult.savedSearchesImported} saved searches, ${importResult.remindersImported} reminders, ${importResult.notificationsImported} notifications${importResult.profileImported ? ", profile" : ""}${importResult.eligibilityAnswersImported ? ", eligibility answers" : ""}${importResult.reminderPreferencesImported ? ", reminder preferences" : ""}${importResult.planningPreferencesImported ? ", planning preferences" : ""}${importResult.displayPreferencesImported ? ", display preferences" : ""}.`
              : importResult.error}
          </Alert>
        ) : null}

        {pending ? (
          <div className="mt-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">Export summary</p>
            <ul className="mt-1 list-inside list-disc text-sm text-foreground-muted">
              <li>Exported {new Date(pending.summary.exportedAt).toLocaleString()}</li>
              <li>{pending.summary.trackingCount} tracked opportunities</li>
              <li>{pending.summary.notesCount} notes</li>
              <li>{pending.summary.checklistTaskCount} checklist tasks</li>
              <li>{pending.summary.customOpportunityCount} custom opportunities</li>
              <li>{pending.summary.savedSearchCount} saved searches</li>
              <li>{pending.summary.reminderCount} reminders</li>
            </ul>

            <div className="mt-3">
              <Label htmlFor="cloud-import-mode">Import mode</Label>
              <Select id="cloud-import-mode" value={importMode} onChange={(e) => setImportMode(e.target.value as "merge" | "replace")} className="mt-1 w-auto">
                <option value="merge">Merge — keep existing data, add/update from the file</option>
                <option value="replace">Replace — remove existing cloud data first</option>
              </Select>
            </div>

            {importMode === "replace" ? (
              <Alert tone="warning" title="This will delete your current cloud data" className="mt-3">
                Everything currently in your account workspace will be removed before the file is imported.
              </Alert>
            ) : null}

            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => void confirmImport()}>
                Import
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
