import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "green" | "amber" | "red" | "blue" | "grey" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: "bg-success-tint text-success border-success/30",
  amber: "bg-warning-tint text-warning border-warning/30",
  red: "bg-danger-tint text-danger border-danger/30",
  blue: "bg-info-tint text-info border-info/30",
  grey: "bg-neutral-tint text-foreground-muted border-border",
  neutral: "bg-surface-muted text-foreground-muted border-border",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: ReactNode;
}

/**
 * Every badge carries visible text (and optionally an icon) alongside its
 * colour — colour is never the only status signal.
 */
export function Badge({ tone = "neutral", icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium leading-none whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  );
}
