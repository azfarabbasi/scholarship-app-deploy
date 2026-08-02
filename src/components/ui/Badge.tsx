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
  /**
   * Allows the label to wrap onto a second line. Off by default because a badge
   * in a row of badges should stay on one line; turn it on where the label is a
   * full sentence in a narrow column (e.g. "Deadline passed for this cycle" in a
   * card), which otherwise overflows its container.
   *
   * A prop rather than a `className` override on purpose: `cn` is plain clsx
   * with no Tailwind conflict resolution, so passing `whitespace-normal`
   * alongside the baked-in `whitespace-nowrap` leaves both in the class list and
   * lets stylesheet order silently decide the winner — the same trap documented
   * in Header.tsx.
   */
  wrap?: boolean;
}

/**
 * Every badge carries visible text (and optionally an icon) alongside its
 * colour — colour is never the only status signal.
 */
export function Badge({ tone = "neutral", icon, wrap, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        wrap ? "items-start text-left leading-snug" : "items-center leading-none whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center", wrap && "mt-px")}>
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  );
}
