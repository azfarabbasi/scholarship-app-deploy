import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * The base tint plus a directional shimmer sweep (see `.shimmer` in
 * globals.css) rather than a flat opacity pulse — a sweep reads as "working"
 * on a long load where a blink reads as a broken element. Both the sweep and
 * the pulse fall back to a static block under prefers-reduced-motion.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("shimmer rounded-md bg-surface-muted", className)}
      {...props}
    />
  );
}
