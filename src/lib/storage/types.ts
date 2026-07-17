import type { OpportunityTypeCode } from "@/lib/domain";
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import type { EligibilityAnswersInput } from "@/lib/schemas/eligibility-answers";
import type { StudyLevel } from "@/lib/schemas/opportunity-seed";

/**
 * v2 adds the `publicCatalogueCache` store (Checkpoint 2: the public
 * catalogue moved from a build-time JSON import to a database-backed API
 * response, which now needs an offline cache with its own store).
 * v3 adds `cloudCache` and `syncOutbox` (Checkpoint 3: signed-in accounts
 * cache their last-fetched cloud workspace for offline reads, and queue
 * mutations made while offline). Both are keyed to a specific
 * `studentProfileId` and are cleared on sign-out — never shared with guest
 * data or another account on the same device/browser.
 * v4 adds `eligibilityAnswers`, `savedSearches`, `reminderPreferences`,
 * `reminders`, and `notifications` (Checkpoint 4: optional eligibility
 * questionnaire, saved searches, reminders, and the notification center —
 * all guest-local here, same as every other guest store).
 */
export const SCHEMA_VERSION = 4;

/** Last successfully fetched snapshot of the public database catalogue, for offline use. */
export interface PublicCatalogueCacheRecord {
  key: "snapshot";
  items: CatalogueOpportunity[];
  syncedAt: string;
}

export const APPLICATION_STAGE_OPTIONS = [
  "not-started",
  "researching",
  "preparing",
  "ready-to-apply",
  "submitted",
  "interview-or-assessment",
  "awarded",
  "unsuccessful",
  "withdrawn",
] as const;

export type ApplicationStageOption = (typeof APPLICATION_STAGE_OPTIONS)[number];

export const APPLICATION_STAGE_LABELS: Record<ApplicationStageOption, string> = {
  "not-started": "Not started",
  researching: "Researching",
  preparing: "Preparing",
  "ready-to-apply": "Ready to apply",
  submitted: "Submitted",
  "interview-or-assessment": "Interview or assessment",
  awarded: "Awarded",
  unsuccessful: "Unsuccessful",
  withdrawn: "Withdrawn",
};

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  origin: "template" | "user";
  createdAt: string;
  updatedAt: string;
}

export const GENERIC_CHECKLIST_TEMPLATE: readonly string[] = [
  "Verify the official source",
  "Confirm eligibility",
  "Review required documents",
  "Request references",
  "Prepare personal statement",
  "Review the application",
  "Submit before the deadline",
];

export interface WorkspaceRecord {
  opportunityId: string;
  shortlisted: boolean;
  stage: ApplicationStageOption;
  notes: string;
  checklist: ChecklistItem[];
  personalDeadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CustomDeadlineKind = "exact" | "estimated" | "rolling" | "unknown";

export interface CustomOpportunityRecord {
  id: string;
  slug: string;
  title: string;
  opportunityType: OpportunityTypeCode;
  providerName: string | null;
  countries: string[];
  regions: string[];
  studyLevels: StudyLevel[];
  benefitSummary: string;
  eligibilitySummary: string;
  officialUrl: string | null;
  deadlineKind: CustomDeadlineKind;
  deadlineRawText: string;
  deadlineDate: string | null;
  deadlineTimezone: string | null;
  verificationNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningPreferences {
  expectedGraduationDate: string | null;
  targetIntakeYear: number | null;
  targetIntakeTerm: string | null;
  preferredStudyLevels: StudyLevel[];
  preferredCountries: string[];
}

export const DEFAULT_PLANNING_PREFERENCES: PlanningPreferences = {
  expectedGraduationDate: null,
  targetIntakeYear: null,
  targetIntakeTerm: null,
  preferredStudyLevels: [],
  preferredCountries: [],
};

export interface DisplayPreferences {
  catalogueView: "grid" | "list";
}

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  catalogueView: "grid",
};

export interface PreferencesRecord {
  id: "singleton";
  planning: PlanningPreferences;
  display: DisplayPreferences;
  updatedAt: string;
}

export interface BackupMetaRecord {
  key: "backupMeta";
  lastBackupAt: string | null;
}

/**
 * A minimal, JSON-serialisable mirror of the signed-in student's cloud rows,
 * cached locally so the workspace UI can render (read-only) while offline.
 * Field shapes intentionally match the Server Action return rows with dates
 * as ISO strings rather than importing the Drizzle-inferred row types here
 * (this module must stay usable outside a server context).
 */
export interface CloudWorkspaceSnapshot {
  tracking: Array<{
    id: string;
    opportunityId: string;
    shortlisted: boolean;
    stage: ApplicationStageOption;
    personalDeadline: string | null;
    priority: number | null;
    archived: boolean;
    updatedAt: string;
  }>;
  notes: Array<{ id: string; targetType: "built-in" | "custom"; targetId: string; noteText: string; updatedAt: string }>;
  checklistTasks: Array<{
    id: string;
    targetType: "built-in" | "custom";
    targetId: string;
    taskText: string;
    completed: boolean;
    sortOrder: number;
    updatedAt: string;
  }>;
  customOpportunities: Array<{
    id: string;
    slug: string;
    title: string;
    opportunityType: string;
    providerName: string | null;
    countries: string[];
    regions: string[];
    studyLevels: string[];
    benefitSummary: string;
    eligibilitySummary: string;
    officialUrl: string | null;
    deadlineKind: CustomDeadlineKind;
    deadlineRawText: string;
    deadlineDate: string | null;
    updatedAt: string;
  }>;
}

export interface CloudCacheRecord {
  studentProfileId: string;
  snapshot: CloudWorkspaceSnapshot;
  cachedAt: string;
}

// --- Checkpoint 4: eligibility answers, saved searches, reminders, notifications ---

export interface EligibilityAnswersRecord {
  id: "singleton";
  answers: EligibilityAnswersInput;
  updatedAt: string;
}

export function defaultEligibilityAnswersRecord(): EligibilityAnswersRecord {
  return {
    id: "singleton",
    answers: { fieldsOfInterest: [], preferredCountries: [], preferredRegions: [] },
    updatedAt: new Date().toISOString(),
  };
}

export interface SavedSearchRecord {
  id: string;
  name: string;
  queryText: string;
  /** A serialised `CatalogueFilters` — kept as an untyped bag here to avoid a storage↔catalogue import cycle. */
  filters: Record<string, unknown>;
  sortMode: string;
  resultCountSnapshot: number | null;
  /** Opportunity ids present the last time this search was checked — the alert diff compares against this. */
  resultSnapshot: string[];
  lastCheckedAt: string | null;
  alertsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const REMINDER_LEAD_DAY_OPTIONS = [0, 1, 3, 7, 14, 30] as const;
export type ReminderLeadDays = (typeof REMINDER_LEAD_DAY_OPTIONS)[number];

export interface ReminderPreferencesRecord {
  id: "singleton";
  remindersEnabled: boolean;
  officialLeadDays: number[];
  personalLeadDays: number[];
  savedSearchAlertsEnabled: boolean;
  updatedAt: string;
}

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferencesRecord = {
  id: "singleton",
  remindersEnabled: true,
  officialLeadDays: [7],
  personalLeadDays: [1, 7],
  savedSearchAlertsEnabled: true,
  updatedAt: new Date(0).toISOString(),
};

export type ReminderSource = "official-deadline" | "personal-deadline" | "checklist" | "saved-search" | "system";
export type ReminderStatus = "pending" | "dismissed" | "completed";

export interface ReminderRecord {
  id: string;
  stableKey: string;
  source: ReminderSource;
  targetType: "built-in" | "custom" | null;
  targetId: string | null;
  title: string;
  dueAt: string;
  leadDays: number;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = "reminder-upcoming" | "reminder-overdue" | "saved-search-alert" | "system";
export type NotificationStatus = "unread" | "read" | "dismissed";

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  source: ReminderSource;
  title: string;
  message: string;
  targetType: "built-in" | "custom" | null;
  targetId: string | null;
  savedSearchId: string | null;
  dueAt: string | null;
  status: NotificationStatus;
  readAt: string | null;
  createdAt: string;
}

export type OutboxEntry =
  | { id: string; studentProfileId: string; createdAt: string; kind: "tracking"; opportunityId: string; patch: Record<string, unknown> }
  | { id: string; studentProfileId: string; createdAt: string; kind: "note"; targetType: "built-in" | "custom"; targetId: string; noteText: string }
  | { id: string; studentProfileId: string; createdAt: string; kind: "checklist-add"; targetType: "built-in" | "custom"; targetId: string; taskText: string }
  | { id: string; studentProfileId: string; createdAt: string; kind: "checklist-toggle"; taskId: string }
  | { id: string; studentProfileId: string; createdAt: string; kind: "checklist-rename"; taskId: string; taskText: string }
  | { id: string; studentProfileId: string; createdAt: string; kind: "checklist-delete"; taskId: string }
  | { id: string; studentProfileId: string; createdAt: string; kind: "planning-preferences"; patch: Record<string, unknown> }
  | { id: string; studentProfileId: string; createdAt: string; kind: "display-preferences"; patch: Record<string, unknown> };
