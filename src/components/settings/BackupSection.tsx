"use client";

import { AlertTriangle, Download, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Label, Select } from "@/components/ui/Field";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";
import { useCatalogue } from "@/hooks/useCatalogue";
import {
  buildBackupPayload,
  buildTrackedApplicationsCsv,
  clearAllGuestData,
  importBackupPayload,
  MAX_BACKUP_FILE_SIZE_BYTES,
  recordBackupCreated,
  validateBackupPayload,
  type BackupValidationSuccess,
  type ImportMode,
} from "@/lib/storage/backup";
import { checklistProgress } from "@/lib/storage/workspace";
import { downloadTextFile } from "@/lib/download";

function timestampSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function BackupSection() {
  const { announce } = useLiveAnnouncer();
  const { items } = useCatalogue();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<BackupValidationSuccess | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleExportJson() {
    const payload = await buildBackupPayload();
    downloadTextFile(
      `scholartrack-backup-${timestampSuffix()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    await recordBackupCreated();
    announce("Backup exported.");
  }

  function handleExportCsv() {
    const rows = items
      .filter((item) => item.workspace)
      .map((item) => {
        const progress = checklistProgress(item.workspace!.checklist);
        return {
          title: item.opportunity.title,
          kind: item.opportunity.kind,
          stage: item.workspace!.stage,
          shortlisted: item.workspace!.shortlisted,
          personalDeadline: item.workspace!.personalDeadline,
          checklistDone: progress.done,
          checklistTotal: progress.total,
          updatedAt: item.workspace!.updatedAt,
        };
      });
    downloadTextFile(`scholartrack-applications-${timestampSuffix()}.csv`, buildTrackedApplicationsCsv(rows), "text/csv");
    announce("Applications exported as CSV.");
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    setPending(null);
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) {
      setFileError(`File is too large (${Math.round(file.size / 1024)} KB). The maximum allowed is 5 MB.`);
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = validateBackupPayload(json);
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
    const result = await importBackupPayload(pending.payload, importMode);
    announce(
      `Import complete: ${result.workspaceImported} tracked opportunities and ${result.customOpportunitiesImported} custom opportunities.`,
    );
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Export</h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Your export contains tracking state, notes, checklists, custom opportunities, and preferences. It never
          includes cookies, analytics, or document files.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleExportJson()}>
            <Download className="h-4 w-4" aria-hidden="true" /> Export full backup (JSON)
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4" aria-hidden="true" /> Export applications (CSV)
          </Button>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Import</h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Import a previously exported ScholarTrack backup file (JSON, up to 5 MB).
        </p>
        <div className="mt-3">
          <Label htmlFor="backup-file" className="sr-only">
            Choose a backup file
          </Label>
          <input
            ref={fileInputRef}
            id="backup-file"
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

        {pending ? (
          <div className="mt-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">Backup summary</p>
            <ul className="mt-1 list-inside list-disc text-sm text-foreground-muted">
              <li>Schema version {pending.summary.schemaVersion}</li>
              <li>Created {new Date(pending.summary.createdAt).toLocaleString()}</li>
              <li>{pending.summary.workspaceCount} tracked opportunities</li>
              <li>{pending.summary.customOpportunityCount} custom opportunities</li>
              <li>{pending.summary.hasPreferences ? "Includes preferences" : "No preferences included"}</li>
            </ul>

            <div className="mt-3">
              <Label htmlFor="import-mode">Import mode</Label>
              <Select
                id="import-mode"
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as ImportMode)}
                className="mt-1 w-auto"
              >
                <option value="merge">Merge — keep existing data, add/update from backup</option>
                <option value="replace">Replace — remove existing data first</option>
              </Select>
            </div>

            {importMode === "replace" ? (
              <Alert tone="warning" title="This will delete your current local data" className="mt-3">
                Everything currently saved on this device will be removed before the backup is imported.
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

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Clear all local data</h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Permanently removes your shortlist, notes, checklists, custom opportunities, and preferences from this
          browser. This cannot be undone unless you have a backup.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" size="sm" className="mt-3">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear all local data
            </Button>
          </DialogTrigger>
          <DialogContent
            title="Clear all local data?"
            description="This permanently deletes all guest data stored in this browser. Export a backup first if you want to keep it."
          >
            <Alert tone="warning" className="mt-2">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> This cannot be undone.
              </span>
            </Alert>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await clearAllGuestData();
                    announce("All local data has been cleared.");
                  }}
                >
                  Clear everything
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
