"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

export interface DialogContentProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function DialogContent({ title, description, children, className }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-lg focus:outline-none",
          className,
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <RadixDialog.Title className="text-base font-semibold text-foreground">{title}</RadixDialog.Title>
            <RadixDialog.Description
              className={description ? "mt-1 text-sm text-foreground-muted" : "sr-only"}
            >
              {description ?? title}
            </RadixDialog.Description>
          </div>
          <RadixDialog.Close
            className="rounded-md p-1 text-foreground-subtle hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </RadixDialog.Close>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export const DialogClose = RadixDialog.Close;
