"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { isScholarlyWidgetPath } from "@/lib/assistant/scholarly-widget-pages";
import { AssistantChat } from "./AssistantChat";

const GENERAL_PROMPTS = ["Explain how deadlines work here", "What should I look at first?", "Help me compare my shortlist"];

/**
 * A quick-access companion to the full `/assistant` page — never a second
 * copy of its persisted history. Every exchange here is forced into
 * "temporary chat" mode (see `defaultTemporary` below), so `studentProfileId`
 * is deliberately always `null`: neither the guest IndexedDB path nor the
 * signed-in cloud path in `useAssistantChat` ever runs for a temporary turn,
 * so there is nothing session-specific for this component to know.
 */
export function ScholarlyWidget({ aiAvailable }: { aiAvailable: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  // Move focus into the panel when it opens (so Escape below actually has
  // something to bubble through), and back to the launcher when it closes —
  // standard dialog/drawer focus management. Guarded by `wasOpenRef` so this
  // never steals focus to the launcher on the widget's initial, closed mount.
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    } else if (wasOpenRef.current) {
      launcherRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  if (!isScholarlyWidgetPath(pathname)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-label="Scholarly quick assistant"
          className="flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-lg focus:outline-none"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Scholarly</p>
                <p className="text-xs text-foreground-subtle">Quick questions, grounded in your data</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Scholarly"
              className="rounded-md p-1.5 text-foreground-subtle hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {aiAvailable ? (
            <>
              <AssistantChat
                studentProfileId={null}
                scope="general"
                compact
                defaultTemporary
                placeholder="Ask Scholarly…"
                emptyStateText="Quick, unsaved questions — ask about a scholarship, a deadline, or what to do next."
                suggestedPrompts={GENERAL_PROMPTS}
              />
              <Link href="/assistant" className="text-xs font-medium text-brand hover:underline">
                Open the full Scholarly assistant →
              </Link>
            </>
          ) : (
            <p className="text-sm text-foreground-muted">
              Scholarly is not enabled yet. You can still browse and search the full catalogue without it.
            </p>
          )}
        </div>
      ) : null}

      <span className="relative flex">
        {/* Expanding ring, drawn behind the launcher and only while it's closed,
            so the widget advertises itself once without competing with the
            panel's own content. Decorative and pointer-transparent. */}
        {!open ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-full bg-brand/40 motion-reduce:hidden"
          />
        ) : null}
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Minimize Scholarly" : "Ask Scholarly"}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-brand transition-transform duration-300 hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Sparkles className="h-6 w-6" aria-hidden="true" />}
        </button>
      </span>
    </div>
  );
}
