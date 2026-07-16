"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { APPLICATION_STAGE_LABELS, APPLICATION_STAGE_OPTIONS, type ApplicationStageOption } from "@/lib/storage/types";
import type { CloudWorkspaceSnapshot } from "@/lib/storage/types";

type TrackingRow = CloudWorkspaceSnapshot["tracking"][number];
type NoteRow = CloudWorkspaceSnapshot["notes"][number];
type TaskRow = CloudWorkspaceSnapshot["checklistTasks"][number];

interface CloudTrackedItemProps {
  title: string;
  tracking: TrackingRow;
  note: NoteRow | undefined;
  tasks: TaskRow[];
  onPatchTracking: (patch: { shortlisted?: boolean; stage?: ApplicationStageOption; personalDeadline?: string | null }) => void;
  onSaveNote: (noteText: string) => void;
  onAddTask: (taskText: string) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export function CloudTrackedItem({
  title,
  tracking,
  note,
  tasks,
  onPatchTracking,
  onSaveNote,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: CloudTrackedItemProps) {
  const [noteDraft, setNoteDraft] = useState(note?.noteText ?? "");
  const [newTask, setNewTask] = useState("");

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-foreground">{title}</h3>
        <Checkbox
          id={`shortlist-${tracking.opportunityId}`}
          label="Shortlisted"
          checked={tracking.shortlisted}
          onChange={(e) => onPatchTracking({ shortlisted: e.target.checked })}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`stage-${tracking.opportunityId}`}>Application stage</Label>
          <Select
            id={`stage-${tracking.opportunityId}`}
            value={tracking.stage}
            onChange={(e) => onPatchTracking({ stage: e.target.value as ApplicationStageOption })}
          >
            {APPLICATION_STAGE_OPTIONS.map((stage) => (
              <option key={stage} value={stage}>
                {APPLICATION_STAGE_LABELS[stage]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`deadline-${tracking.opportunityId}`}>Personal deadline</Label>
          <Input
            id={`deadline-${tracking.opportunityId}`}
            type="date"
            value={tracking.personalDeadline ? tracking.personalDeadline.slice(0, 10) : ""}
            onChange={(e) => onPatchTracking({ personalDeadline: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor={`note-${tracking.opportunityId}`}>Notes</Label>
        <Textarea
          id={`note-${tracking.opportunityId}`}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteDraft !== (note?.noteText ?? "")) onSaveNote(noteDraft);
          }}
        />
      </div>

      <div className="mt-3">
        <p className="text-sm font-medium text-foreground">Checklist</p>
        <ul className="mt-1 flex flex-col gap-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2">
              <Checkbox id={`task-${task.id}`} label={task.taskText} checked={task.completed} onChange={() => onToggleTask(task.id)} />
              <button
                type="button"
                className="text-xs text-foreground-subtle underline"
                onClick={() => onDeleteTask(task.id)}
                aria-label={`Delete task ${task.taskText}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <Input
            aria-label="New checklist task"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task"
            className="max-w-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (newTask.trim()) {
                onAddTask(newTask.trim());
                setNewTask("");
              }
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </li>
  );
}
