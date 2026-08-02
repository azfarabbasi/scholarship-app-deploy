"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { buildBackupPayload, type BackupPayload } from "@/lib/storage/backup";
import { getMigrationContext, applyGuestMigration, type MigrationMode, type MigrationResult } from "@/lib/db/actions/student/sync";

type LoadState =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "ready";
      guest: BackupPayload;
      cloudCounts: {
        tracking: number;
        notes: number;
        checklistTasks: number;
        customOpportunities: number;
        savedSearches: number;
        reminders: number;
      };
      collisions: number;
    };

/**
 * Built as a plain string rather than interleaved JSX. The previous inline form
 * wrapped mid-sentence, and the JSX transform trims the leading whitespace of a
 * wrapped text node — so every count ran into the noun after it
 * ("3custom opportunities copied"). Assembling the sentence here also fixes the
 * singular/plural stems, one of which produced "opportunityies" for any count
 * other than 1.
 */
function migrationSummary(result: MigrationResult): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const parts = [
    `${plural(result.trackingCreated, "opportunity", "opportunities")} copied`,
    `${result.trackingSkipped} skipped as duplicates`,
    `${plural(result.customOpportunitiesCreated, "custom opportunity", "custom opportunities")} copied`,
    `${result.notesWritten} note(s) written`,
    `${result.checklistTasksWritten} checklist task(s) written`,
    `${plural(result.savedSearchesCreated, "saved search", "saved searches")} copied`,
    `${plural(result.remindersCreated, "reminder", "reminders")} copied`,
  ];

  if (result.eligibilityAnswersMigrated) parts.push("eligibility answers copied");
  if (result.reminderPreferencesMigrated) parts.push("reminder preferences copied");

  return `${parts.join(", ")}.`;
}

export function MigrationPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [mode, setMode] = useState<MigrationMode>("merge");
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [guest, context] = await Promise.all([buildBackupPayload(), getMigrationContext()]);
        if (!context) {
          setState({ status: "unavailable" });
          return;
        }
        const collisions = guest.data.workspace.filter((record) => context.existingOpportunityIds.includes(record.opportunityId)).length;
        setState({ status: "ready", guest, cloudCounts: context.cloudCounts, collisions });
      } catch {
        setState({ status: "unavailable" });
      }
    }
    void load();
  }, []);

  async function apply() {
    if (state.status !== "ready") return;
    setApplying(true);
    const outcome = await applyGuestMigration(state.guest, mode);
    setApplying(false);
    setResult(outcome);
    setConfirmingReplace(false);
  }

  if (state.status === "loading") {
    return <p className="text-sm text-foreground-muted">Reading your local guest data…</p>;
  }

  if (state.status === "unavailable") {
    return <Alert tone="warning">Local guest data isn&rsquo;t available in this browser (or you&rsquo;re not signed in).</Alert>;
  }

  const guestCounts = {
    tracking: state.guest.data.workspace.length,
    customOpportunities: state.guest.data.customOpportunities.length,
    notes: state.guest.data.workspace.filter((r) => r.notes.trim().length > 0).length,
    checklistTasks: state.guest.data.workspace.reduce((sum, r) => sum + r.checklist.length, 0),
    savedSearches: state.guest.data.savedSearches?.length ?? 0,
    reminders: state.guest.data.reminders?.length ?? 0,
    hasEligibilityAnswers: Boolean(state.guest.data.eligibilityAnswers),
  };

  const hasNothingToMigrate =
    guestCounts.tracking === 0 &&
    guestCounts.customOpportunities === 0 &&
    guestCounts.savedSearches === 0 &&
    guestCounts.reminders === 0 &&
    !guestCounts.hasEligibilityAnswers;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-foreground">Bring in your guest data</h2>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {result ? (
          <Alert tone="success" title="Migration complete">
            {migrationSummary(result)}
            {result.conflicts.length > 0 ? (
              <span className="mt-1 block font-medium">
                {result.conflicts.length}{" "}
                item(s) need review — the cloud version was newer and was kept.
              </span>
            ) : null}
          </Alert>
        ) : null}

        {hasNothingToMigrate ? (
          <Alert tone="info">Nothing to bring in — this browser has no guest workspace data yet.</Alert>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-foreground-muted">Tracked (local)</p>
                <p className="font-semibold text-foreground">{guestCounts.tracking}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Notes (local)</p>
                <p className="font-semibold text-foreground">{guestCounts.notes}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Checklist tasks (local)</p>
                <p className="font-semibold text-foreground">{guestCounts.checklistTasks}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Custom opportunities (local)</p>
                <p className="font-semibold text-foreground">{guestCounts.customOpportunities}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Saved searches (local)</p>
                <p className="font-semibold text-foreground">{guestCounts.savedSearches}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Reminders (local)</p>
                <p className="font-semibold text-foreground">{guestCounts.reminders}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Eligibility answers (local)</p>
                <p className="font-semibold text-foreground">{guestCounts.hasEligibilityAnswers ? "Saved" : "None"}</p>
              </div>
            </div>

            <p className="text-sm text-foreground-muted">
              Your account already has {state.cloudCounts.tracking}{" "}
              tracked opportunit{state.cloudCounts.tracking === 1 ? "y" : "ies"}
              {state.collisions > 0 ? ` (${state.collisions} overlap with your local data)` : ""}.
            </p>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-foreground">How should we combine this?</legend>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="migration-mode" checked={mode === "copy"} onChange={() => setMode("copy")} className="mt-1" />
                <span>
                  <span className="font-medium text-foreground">Copy</span> — add local items that don&rsquo;t already exist in
                  the cloud; never overwrite anything.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="migration-mode" checked={mode === "merge"} onChange={() => setMode("merge")} className="mt-1" />
                <span>
                  <span className="font-medium text-foreground">Merge</span> — for overlapping items, keep whichever was
                  updated more recently.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="migration-mode"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-danger">Replace</span> — delete your existing cloud workspace and
                  replace it with this browser&rsquo;s local data.
                </span>
              </label>
            </fieldset>

            {mode === "replace" && !confirmingReplace ? (
              <Button variant="danger" onClick={() => setConfirmingReplace(true)} className="w-fit">
                Continue with replace…
              </Button>
            ) : (
              <Button onClick={() => void apply()} disabled={applying} className="w-fit">
                {applying ? "Applying…" : mode === "replace" ? "Confirm: replace cloud data" : "Apply"}
              </Button>
            )}

            <p className="text-xs text-foreground-muted">
              Your local guest data on this device is never deleted by this step — it stays here until you clear it
              yourself from Settings.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
