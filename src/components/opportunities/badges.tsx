import {
  AlertTriangle,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock,
  Flag,
  HelpCircle,
  Landmark,
  PenLine,
  RefreshCw,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/Badge";
import type { CatalogueOpportunityKind } from "@/lib/catalogue/types";
import type { StudentFacingDeadlineLabel } from "@/lib/domain";
import type { DeadlineEvaluationResult } from "@/lib/deadlines/types";
import {
  APPLICATION_STAGE_LABELS,
  type ApplicationStageOption,
} from "@/lib/storage/types";

const LABEL_ICON: Record<StudentFacingDeadlineLabel, ComponentType<{ className?: string }>> = {
  "Apply now": CheckCircle2,
  "Prepare now": CalendarClock,
  "Wait for next cycle": Clock,
  "Verify deadline": HelpCircle,
  "Rolling opportunity": RefreshCw,
  "Deadline passed for this cycle": XCircle,
  "Not yet announced": CalendarX2,
  "Deadline estimate only": AlertTriangle,
};

export function DeadlineBadge({
  evaluation,
  className,
}: {
  evaluation: DeadlineEvaluationResult;
  className?: string;
}) {
  const Icon = LABEL_ICON[evaluation.studentFacingLabel];
  return (
    <Badge tone={evaluation.colorState} icon={<Icon className="h-full w-full" />} className={className}>
      {evaluation.studentFacingLabel}
    </Badge>
  );
}

export function DeadlineCountdownText({ evaluation }: { evaluation: DeadlineEvaluationResult }) {
  if (!evaluation.countdown.allowed || evaluation.countdown.days === null) {
    return null;
  }
  const { state, days } = evaluation.countdown;
  const plural = days === 1 ? "" : "s";
  const text =
    state === "days-remaining"
      ? `${days} day${plural} remaining`
      : state === "deadline-today"
        ? "Closes today"
        : state === "days-since-deadline"
          ? `Closed ${days} day${plural} ago`
          : null;

  return text ? <span className="text-xs text-foreground-subtle">{text}</span> : null;
}

export function VerificationBadge({
  kind,
  verificationRequired,
}: {
  kind: CatalogueOpportunityKind;
  verificationRequired: boolean;
}) {
  if (kind === "custom") {
    return (
      <Badge tone="neutral" icon={<PenLine className="h-full w-full" />}>
        Self-reported — not officially verified
      </Badge>
    );
  }
  if (!verificationRequired) {
    return (
      <Badge tone="green" icon={<ShieldCheck className="h-full w-full" />}>
        Officially reviewed
      </Badge>
    );
  }
  return (
    <Badge tone="grey" icon={<ShieldQuestion className="h-full w-full" />}>
      Not officially verified yet
    </Badge>
  );
}

export function OriginBadge({ kind }: { kind: CatalogueOpportunityKind }) {
  return kind === "custom" ? (
    <Badge tone="neutral" icon={<PenLine className="h-full w-full" />}>
      Custom
    </Badge>
  ) : (
    <Badge tone="neutral" icon={<Landmark className="h-full w-full" />}>
      Catalogue
    </Badge>
  );
}

const STAGE_TONE: Record<ApplicationStageOption, "green" | "red" | "blue" | "grey"> = {
  "not-started": "grey",
  researching: "blue",
  preparing: "blue",
  "ready-to-apply": "blue",
  submitted: "blue",
  "interview-or-assessment": "blue",
  awarded: "green",
  unsuccessful: "red",
  withdrawn: "red",
};

export function StageBadge({ stage }: { stage: ApplicationStageOption }) {
  return (
    <Badge tone={STAGE_TONE[stage]} icon={<Flag className="h-full w-full" />}>
      {APPLICATION_STAGE_LABELS[stage]}
    </Badge>
  );
}
