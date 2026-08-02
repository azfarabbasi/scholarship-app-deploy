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
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { CatalogueOpportunityKind, OverallVerificationStatus } from "@/lib/catalogue/types";
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
  wrap,
}: {
  evaluation: DeadlineEvaluationResult;
  className?: string;
  /** See Badge's `wrap` — these labels are sentences and overflow narrow columns. */
  wrap?: boolean;
}) {
  const Icon = LABEL_ICON[evaluation.studentFacingLabel];
  return (
    <Badge tone={evaluation.colorState} icon={<Icon className="h-full w-full" />} wrap={wrap} className={className}>
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

/**
 * Phase 5 (launch-audit remediation): this used to take the *deadline's* own
 * `verificationRequired` flag, which tracks whether a single date fact needs
 * a human re-check — a narrower, independent signal (see the comment on
 * `verificationRequired` in `src/lib/deadlines/engine.ts`). A deadline being
 * freshly verified says nothing about whether the opportunity as a whole
 * ever passed staff review with a confirmed-official source, and vice versa,
 * so the badge could show "Officially reviewed" right next to the detail
 * page's own accurate `VERIFICATION_STATUS_LABELS` section (see
 * OpportunityDetailBody.tsx) reporting the opposite. `status` is the
 * opportunity-level `CatalogueVerificationInfo.status`, the one field the
 * codebase already documents as the deliberately-separate source of truth
 * for this (see the module comment on `CatalogueVerificationInfo`).
 */
/**
 * Short label + `title` holding the full sentence.
 *
 * These labels used to be the whole explanation ("Verified previously — due for
 * recheck"), which on a card grid meant every tile carried a line of legal-ish
 * prose and the actual scholarship details had to compete with it. The badge
 * still carries visible text, never colour alone — the promise in Badge.tsx —
 * it is just the short form, with the long form one hover/focus away and
 * spelled out in full on the detail page.
 */
const VERIFICATION_PRESETS = {
  custom: {
    tone: "neutral",
    Icon: PenLine,
    label: "Self-added",
    title: "Self-reported custom opportunity — not officially verified.",
  },
  verified: {
    tone: "green",
    Icon: ShieldCheck,
    label: "Verified",
    title: "Officially reviewed by staff against a confirmed source.",
  },
  partially_verified: {
    tone: "amber",
    Icon: ShieldQuestion,
    label: "Part-verified",
    title: "Partially reviewed by staff — some facts are still unconfirmed.",
  },
  stale: {
    tone: "amber",
    Icon: ShieldQuestion,
    label: "Recheck due",
    title: "Verified previously, but now past its re-check window.",
  },
  unverified: {
    tone: "grey",
    Icon: ShieldQuestion,
    label: "Unverified",
    title: "Not officially verified yet — confirm on the official website.",
  },
} as const satisfies Record<string, { tone: BadgeTone; Icon: ComponentType<{ className?: string }>; label: string; title: string }>;

export function VerificationBadge({
  kind,
  status,
}: {
  kind: CatalogueOpportunityKind;
  status: OverallVerificationStatus;
}) {
  const preset =
    kind === "custom"
      ? VERIFICATION_PRESETS.custom
      : status === "verified"
        ? VERIFICATION_PRESETS.verified
        : status === "partially_verified"
          ? VERIFICATION_PRESETS.partially_verified
          : status === "stale"
            ? VERIFICATION_PRESETS.stale
            : VERIFICATION_PRESETS.unverified;

  const { Icon } = preset;
  return (
    <Badge tone={preset.tone} icon={<Icon className="h-full w-full" />} title={preset.title}>
      {preset.label}
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
