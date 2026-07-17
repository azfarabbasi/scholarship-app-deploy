import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, ShieldQuestion, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { MATCH_LABEL_TEXT, type MatchLabel } from "@/lib/matching/types";

/** Icon + text together, never colour alone, per the accessibility requirement. */
const LABEL_STYLE: Record<MatchLabel, { icon: typeof CheckCircle2; className: string }> = {
  "strong-potential-fit": { icon: CheckCircle2, className: "bg-success-tint text-success border-success/30" },
  "possible-fit": { icon: HelpCircle, className: "bg-info-tint text-info border-info/30" },
  "needs-verification": { icon: ShieldQuestion, className: "bg-warning-tint text-warning border-warning/30" },
  "missing-information": { icon: AlertCircle, className: "bg-surface-muted text-foreground-muted border-border" },
  "likely-not-a-fit": { icon: XCircle, className: "bg-danger-tint text-danger border-danger/30" },
  "deadline-risk": { icon: AlertTriangle, className: "bg-warning-tint text-warning border-warning/30" },
  "not-enough-rule-data": { icon: AlertCircle, className: "bg-surface-muted text-foreground-muted border-border" },
};

export function MatchBadge({ label, className }: { label: MatchLabel; className?: string }) {
  const { icon: Icon, className: styleClassName } = LABEL_STYLE[label];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", styleClassName, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {MATCH_LABEL_TEXT[label]}
    </span>
  );
}
