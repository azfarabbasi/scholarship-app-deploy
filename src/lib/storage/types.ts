import type { OpportunityTypeCode } from "@/lib/domain";
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import type { StudyLevel } from "@/lib/schemas/opportunity-seed";

/**
 * v2 adds the `publicCatalogueCache` store (Checkpoint 2: the public
 * catalogue moved from a build-time JSON import to a database-backed API
 * response, which now needs an offline cache with its own store).
 */
export const SCHEMA_VERSION = 2;

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
