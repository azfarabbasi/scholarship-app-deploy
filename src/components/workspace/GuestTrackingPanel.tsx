"use client";

import { Bookmark, BookmarkCheck, ListChecks, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";
import { useWorkspaceRecord } from "@/hooks/useWorkspace";
import { checklistProgress } from "@/lib/storage/workspace";
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGE_OPTIONS,
  type ApplicationStageOption,
} from "@/lib/storage/types";
import { evaluatePersonalDeadline } from "@/lib/deadlines/personal";
import { useNow } from "@/hooks/useNow";

export function GuestTrackingPanel({ opportunityId, title }: { opportunityId: string; title: string }) {
  const {
    record,
    loading,
    toggleShortlist,
    setStage,
    saveNotes,
    setDeadline,
    addTask,
    renameTask,
    toggleTask,
    deleteTask,
    addGenericChecklist,
    resetGenericTasks,
  } = useWorkspaceRecord(opportunityId);
  const { announce } = useLiveAnnouncer();
  const now = useNow();

  const [notesDraft, setNotesDraft] = useState("");
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [deadlineDraft, setDeadlineDraft] = useState("");
  const notesSaveTimeout = useRef<number | undefined>(undefined);

  // Adjust local draft state during render when the loaded record's saved
  // values change underneath us (initial async load, or an import/restore),
  // rather than syncing via an effect. See React's "Adjusting state when a
  // prop changes" pattern.
  const [syncedNotes, setSyncedNotes] = useState<string | undefined>(undefined);
  const [syncedDeadline, setSyncedDeadline] = useState<string | null | undefined>(undefined);
  if (record && record.notes !== syncedNotes) {
    setSyncedNotes(record.notes);
    setNotesDraft(record.notes);
  }
  if (record && record.personalDeadline !== syncedDeadline) {
    setSyncedDeadline(record.personalDeadline);
    setDeadlineDraft(record.personalDeadline ?? "");
  }

  if (loading || !now) {
    return <Skeleton className="h-96 w-full" />;
  }

  const shortlisted = record?.shortlisted ?? false;
  const stage: ApplicationStageOption = record?.stage ?? "not-started";
  const checklist = record?.checklist ?? [];
  const progress = checklistProgress(checklist);
  const personalDeadlineResult = evaluatePersonalDeadline(record?.personalDeadline ?? null, now);

  function handleNotesChange(value: string) {
    setNotesDraft(value);
    window.clearTimeout(notesSaveTimeout.current);
    notesSaveTimeout.current = window.setTimeout(() => {
      void saveNotes(value).then(() => announce("Notes saved"));
    }, 600);
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Your tracking</h2>
        <Button
          variant={shortlisted ? "secondary" : "outline"}
          size="sm"
          aria-pressed={shortlisted}
          onClick={() => void toggleShortlist()}
        >
          {shortlisted ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
          {shortlisted ? "Shortlisted" : "Add to shortlist"}
        </Button>
      </div>

      <div>
        <Label htmlFor="application-stage">Application stage</Label>
        <Select
          id="application-stage"
          value={stage}
          onChange={(e) => void setStage(e.target.value as ApplicationStageOption)}
          className="mt-1 max-w-xs"
        >
          {APPLICATION_STAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {APPLICATION_STAGE_LABELS[option]}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-foreground-subtle">
          This tracks your own progress only. ScholarTrack never submits an application for you.
        </p>
      </div>

      <div>
        <Label htmlFor="personal-deadline">Your personal deadline</Label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Input
            id="personal-deadline"
            type="date"
            value={deadlineDraft}
            onChange={(e) => setDeadlineDraft(e.target.value)}
            onBlur={() => void setDeadline(deadlineDraft || null)}
            className="w-auto"
          />
          {deadlineDraft ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeadlineDraft("");
                void setDeadline(null);
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear
            </Button>
          ) : null}
        </div>
        {personalDeadlineResult ? (
          <p className="mt-1 text-xs text-foreground-subtle">
            {personalDeadlineResult.state === "invalid" ? personalDeadlineResult.label : `Reminder: ${personalDeadlineResult.label}`}
          </p>
        ) : (
          <p className="mt-1 text-xs text-foreground-subtle">
            This is your own reminder, not an official deadline.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="workspace-notes">Notes</Label>
        <Textarea
          id="workspace-notes"
          value={notesDraft}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Plain-text notes only — never shared, never sent anywhere."
          className="mt-1"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>
            Checklist{" "}
            {checklist.length > 0 ? (
              <span className="font-normal text-foreground-subtle">
                ({progress.done}/{progress.total} complete)
              </span>
            ) : null}
          </Label>
          {checklist.length === 0 ? (
            <Button variant="outline" size="sm" onClick={() => void addGenericChecklist()}>
              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" /> Add starter checklist
            </Button>
          ) : (
            <ResetChecklistDialog onConfirm={() => void resetGenericTasks()} />
          )}
        </div>

        <ul className="flex flex-col gap-1.5">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
              <Checkbox
                id={`task-${item.id}`}
                label={<span className="sr-only">{item.label}</span>}
                checked={item.completed}
                onChange={() => void toggleTask(item.id)}
              />
              <input
                aria-label={`Task label: ${item.label}`}
                value={item.label}
                onChange={(e) => void renameTask(item.id, e.target.value)}
                className={`flex-1 border-none bg-transparent text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] ${item.completed ? "text-foreground-subtle line-through" : ""}`}
              />
              <button
                type="button"
                aria-label={`Delete task: ${item.label}`}
                onClick={() => void deleteTask(item.id)}
                className="rounded p-1 text-foreground-subtle hover:bg-surface-muted hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newTaskLabel.trim().length === 0) return;
            void addTask(newTaskLabel.trim());
            setNewTaskLabel("");
          }}
        >
          <Label htmlFor="new-task" className="sr-only">
            Add a checklist task for {title}
          </Label>
          <Input
            id="new-task"
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            placeholder="Add a task…"
          />
          <Button type="submit" size="sm" variant="outline">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </form>
      </div>

      {record ? (
        <p className="text-xs text-foreground-subtle">
          Last updated {new Date(record.updatedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

function ResetChecklistDialog({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset starter tasks
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Reset starter checklist?"
        description="This removes the generic starter tasks (Verify official source, Confirm eligibility, etc). Tasks you added yourself are kept."
      >
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger" size="sm" onClick={onConfirm}>
              Reset
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
