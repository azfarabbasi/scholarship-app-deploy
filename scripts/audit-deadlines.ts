import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import {
  deadlinePrecisionSchema,
  isoCalendarDateSchema,
  opportunitySeedSchema,
  type DeadlinePrecision,
} from "../src/lib/schemas/opportunity-seed";

const EXPECTED_RECORD_COUNT = 55;
const DATASET_RELATIVE_PATH = join(
  "data",
  "migrations",
  "v0.1",
  "scholarships.seed.json",
);
const SCOPE_CANDIDATE_PATTERN =
  /\b(?:var(?:y|ies)|program(?:-specific)?|institution(?:al)?|universit(?:y|ies)|country|consortium|calls?|most)\b/i;
const ESTIMATE_NOTE_PATTERN = /\b(?:estimat|approximat|not[ -]?reverified|unverified)/i;

type JsonObject = Record<string, unknown>;
type FindingMap = Map<number, FindingRecord>;

interface FindingRecord {
  index: number;
  legacyId: number | string;
  title: string;
  notes: string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function isReadableFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveDatasetPath(): Promise<{
  datasetPath: string;
  attemptedPaths: string[];
}> {
  const attemptedPaths: string[] = [];
  let directory = resolve(process.cwd());
  const filesystemRoot = parse(directory).root;

  while (true) {
    const candidates = [
      join(directory, DATASET_RELATIVE_PATH),
      join(directory, "scholartrack-platform", DATASET_RELATIVE_PATH),
    ];

    for (const candidate of candidates) {
      if (attemptedPaths.includes(candidate)) {
        continue;
      }

      attemptedPaths.push(candidate);

      if (await isReadableFile(candidate)) {
        return { datasetPath: candidate, attemptedPaths };
      }
    }

    if (directory === filesystemRoot) {
      break;
    }

    directory = dirname(directory);
  }

  return {
    datasetPath: resolve(process.cwd(), DATASET_RELATIVE_PATH),
    attemptedPaths,
  };
}

function referenceFor(record: unknown, index: number): FindingRecord {
  if (!isJsonObject(record)) {
    return {
      index,
      legacyId: "?",
      title: `<non-object record ${index + 1}>`,
      notes: [],
    };
  }

  return {
    index,
    legacyId:
      typeof record.legacyId === "number" ? record.legacyId : "?",
    title:
      typeof record.title === "string" && record.title.length > 0
        ? record.title
        : `<untitled record ${index + 1}>`,
    notes: [],
  };
}

function addFinding(
  findings: FindingMap,
  record: unknown,
  index: number,
  note?: string,
): void {
  const existing = findings.get(index);

  if (existing) {
    if (note && !existing.notes.includes(note)) {
      existing.notes.push(note);
    }
    return;
  }

  const reference = referenceFor(record, index);
  if (note) {
    reference.notes.push(note);
  }
  findings.set(index, reference);
}

function sortedFindings(findings: FindingMap): FindingRecord[] {
  return [...findings.values()].sort((left, right) => left.index - right.index);
}

function printFindingGroup(
  severity: "ERROR" | "WARNING" | "POLICY",
  label: string,
  findings: FindingMap,
  explanation: string,
): void {
  console.log(`  [${severity}] ${label}: ${findings.size}`);
  console.log(`    ${explanation}`);

  sortedFindings(findings).forEach((record) => {
    const notes = record.notes.length > 0 ? ` — ${record.notes.join("; ")}` : "";
    console.log(`    - ID ${record.legacyId}: ${record.title}${notes}`);
  });
}

function getAuditDate(): string | null {
  const override = process.env.DEADLINE_AUDIT_DATE;
  const auditDate = override ?? new Date().toISOString().slice(0, 10);

  if (!isoCalendarDateSchema.safeParse(auditDate).success) {
    console.error(
      "ERROR: DEADLINE_AUDIT_DATE must be a valid calendar date in strict YYYY-MM-DD format.",
    );
    return null;
  }

  return auditDate;
}

function validDateStrings(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const dates: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isoCalendarDateSchema.safeParse(item).success) {
      return null;
    }
    dates.push(item);
  }

  return dates;
}

async function main(): Promise<void> {
  const auditDate = getAuditDate();
  if (auditDate === null) {
    process.exitCode = 1;
    return;
  }

  console.log("ScholarTrack deadline audit");
  console.log(`As-of date (UTC calendar date): ${auditDate}`);

  const { datasetPath, attemptedPaths } = await resolveDatasetPath();
  if (!(await isReadableFile(datasetPath))) {
    console.error(`ERROR: Could not find a readable seed dataset from ${process.cwd()}.`);
    console.error("Paths checked:");
    attemptedPaths.forEach((path) => console.error(`  - ${path}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Dataset: ${datasetPath}`);

  let sourceText: string;
  try {
    sourceText = await readFile(datasetPath, "utf8");
  } catch (error) {
    console.error(`ERROR: Could not read the seed dataset: ${errorMessage(error)}`);
    process.exitCode = 1;
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(sourceText) as unknown;
  } catch (error) {
    console.error(`ERROR: Seed dataset contains invalid JSON: ${errorMessage(error)}`);
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(parsed)) {
    console.error("ERROR: Seed dataset must be a top-level JSON array.");
    process.exitCode = 1;
    return;
  }

  const records = parsed;
  const precisionCounts: Record<DeadlinePrecision, number> = {
    exact: 0,
    estimated: 0,
    rolling: 0,
    unknown: 0,
  };
  let unsupportedOrMissingPrecisionCount = 0;

  const schemaInvalid: FindingMap = new Map();
  const datesWithoutSupportedPrecision: FindingMap = new Map();
  const rollingWithDates: FindingMap = new Map();
  const unknownWithDates: FindingMap = new Map();
  const malformedDates: FindingMap = new Map();
  const cycleMismatches: FindingMap = new Map();
  const unorderedDates: FindingMap = new Map();
  const duplicateDates: FindingMap = new Map();

  const estimatedWithoutWarningNote: FindingMap = new Map();
  const missingTimezones: FindingMap = new Map();
  const expired2026: FindingMap = new Map();
  const nextCycleVerification: FindingMap = new Map();
  const notReverified: FindingMap = new Map();
  const scopeCandidates: FindingMap = new Map();
  const automaticRolloverForbidden: FindingMap = new Map();

  records.forEach((record, index) => {
    addFinding(automaticRolloverForbidden, record, index);

    const schemaResult = opportunitySeedSchema.safeParse(record);
    if (!schemaResult.success) {
      schemaResult.error.issues.forEach((issue) => {
        const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "<record>";
        addFinding(schemaInvalid, record, index, `${path}: ${issue.message}`);
      });
    }

    if (!isJsonObject(record)) {
      return;
    }

    const deadline = isJsonObject(record.deadline) ? record.deadline : null;
    const source = isJsonObject(record.source) ? record.source : null;
    const precision = deadline?.precision;
    const datesValue = deadline?.dates;
    const rawDates = Array.isArray(datesValue) ? datesValue : [];
    const dates = validDateStrings(datesValue);

    const precisionResult = deadlinePrecisionSchema.safeParse(precision);
    if (precisionResult.success) {
      precisionCounts[precisionResult.data] += 1;
    } else {
      unsupportedOrMissingPrecisionCount += 1;
    }

    if (!precisionResult.success && rawDates.length > 0) {
      addFinding(
        datesWithoutSupportedPrecision,
        record,
        index,
        `precision=${JSON.stringify(precision)}`,
      );
    }

    if (precision === "rolling" && rawDates.length > 0) {
      addFinding(
        rollingWithDates,
        record,
        index,
        `precision=${precision}; dates=${JSON.stringify(rawDates)}`,
      );
    }

    if (precision === "unknown" && rawDates.length > 0) {
      addFinding(
        unknownWithDates,
        record,
        index,
        `precision=${precision}; dates=${JSON.stringify(rawDates)}`,
      );
    }

    if (dates === null) {
      addFinding(
        malformedDates,
        record,
        index,
        `dates=${JSON.stringify(datesValue)}`,
      );
    } else {
      const duplicateValues = [...new Set(dates.filter((date, dateIndex) =>
        dates.indexOf(date) !== dateIndex,
      ))];
      if (duplicateValues.length > 0) {
        addFinding(
          duplicateDates,
          record,
          index,
          `duplicates=${duplicateValues.join(", ")}`,
        );
      }

      if (dates.some((date, dateIndex) => dateIndex > 0 && date < dates[dateIndex - 1])) {
        addFinding(
          unorderedDates,
          record,
          index,
          `dates=${dates.join(", ")}`,
        );
      }

      if (dates.length > 0) {
        const cycleYear = deadline?.cycleYear;
        const dateYears = [...new Set(dates.map((date) => Number(date.slice(0, 4))))];

        if (
          typeof cycleYear !== "number" ||
          !Number.isInteger(cycleYear) ||
          dateYears.some((year) => year !== cycleYear)
        ) {
          addFinding(
            cycleMismatches,
            record,
            index,
            `cycleYear=${JSON.stringify(cycleYear)}; dateYears=${dateYears.join(", ")}`,
          );
        }

        if (
          cycleYear === 2026 &&
          dates.every((date) => date < auditDate)
        ) {
          addFinding(expired2026, record, index, `dates=${dates.join(", ")}`);
        }
      }

      if (dates.length === 0 || dates.every((date) => date < auditDate)) {
        addFinding(
          nextCycleVerification,
          record,
          index,
          dates.length === 0 ? "undated" : `all dates before ${auditDate}`,
        );
      }
    }

    if (precision === "estimated") {
      const notes = Array.isArray(record.migrationNotes)
        ? record.migrationNotes.filter((note): note is string => typeof note === "string")
        : [];

      if (!notes.some((note) => ESTIMATE_NOTE_PATTERN.test(note))) {
        addFinding(estimatedWithoutWarningNote, record, index);
      }
    }

    const timezone = deadline?.timezone;
    if (timezone === null || typeof timezone !== "string" || timezone.trim() === "") {
      addFinding(missingTimezones, record, index);
    }

    if (source?.verificationStatus === "not-reverified") {
      addFinding(notReverified, record, index);
    }

    if (
      typeof deadline?.rawText === "string" &&
      SCOPE_CANDIDATE_PATTERN.test(deadline.rawText)
    ) {
      addFinding(scopeCandidates, record, index, `rawText=${JSON.stringify(deadline.rawText)}`);
    }
  });

  const structuralGroups = [
    schemaInvalid,
    datesWithoutSupportedPrecision,
    rollingWithDates,
    unknownWithDates,
    malformedDates,
    cycleMismatches,
    unorderedDates,
    duplicateDates,
  ];
  const warningGroups = [
    estimatedWithoutWarningNote,
    missingTimezones,
    expired2026,
    nextCycleVerification,
    notReverified,
    scopeCandidates,
  ];
  const structuralRecordIndices = new Set(
    structuralGroups.flatMap((group) => [...group.keys()]),
  );
  const warningRecordIndices = new Set(
    warningGroups.flatMap((group) => [...group.keys()]),
  );
  const recordCountMismatch = records.length !== EXPECTED_RECORD_COUNT;

  console.log("");
  console.log("Precision counts");
  deadlinePrecisionSchema.options.forEach((precision) => {
    console.log(`  ${precision}: ${precisionCounts[precision]}`);
  });
  console.log(`  unsupported or missing: ${unsupportedOrMissingPrecisionCount}`);

  console.log("");
  console.log("Structural checks (fail the audit when nonzero)");
  console.log(
    `  [ERROR] Record count mismatch: ${recordCountMismatch ? 1 : 0} ` +
      `(found ${records.length}; expected ${EXPECTED_RECORD_COUNT})`,
  );
  printFindingGroup(
    "ERROR",
    "Schema-invalid records",
    schemaInvalid,
    "Any seed-schema violation is structurally invalid.",
  );
  printFindingGroup(
    "ERROR",
    "Dates with missing or unsupported precision",
    datesWithoutSupportedPrecision,
    "Dated records require one of exact, estimated, rolling, or unknown.",
  );
  printFindingGroup(
    "ERROR",
    "Rolling deadlines containing dates",
    rollingWithDates,
    "Rolling deadlines must remain undated.",
  );
  printFindingGroup(
    "ERROR",
    "Unknown deadlines containing dates",
    unknownWithDates,
    "Unknown deadlines must remain undated.",
  );
  printFindingGroup(
    "ERROR",
    "Malformed strict dates",
    malformedDates,
    "Deadline dates must be an array of real calendar dates in YYYY-MM-DD format.",
  );
  printFindingGroup(
    "ERROR",
    "Cycle-year mismatches",
    cycleMismatches,
    "Every stored date year must equal the record's integer cycleYear.",
  );
  printFindingGroup(
    "ERROR",
    "Unordered multiple dates",
    unorderedDates,
    "Multiple deadline dates must be stored in ascending order.",
  );
  printFindingGroup(
    "ERROR",
    "Duplicate dates",
    duplicateDates,
    "A record must not repeat the same deadline date.",
  );

  console.log("");
  console.log("Warnings (do not fail the audit)");
  printFindingGroup(
    "WARNING",
    "Estimated deadlines missing an estimate warning/note",
    estimatedWithoutWarningNote,
    "Estimated records should explicitly preserve their unverified/estimated nature.",
  );
  printFindingGroup(
    "WARNING",
    "Missing deadline timezone",
    missingTimezones,
    "A calendar date cannot produce an exact closing instant without an official timezone.",
  );
  printFindingGroup(
    "WARNING",
    "Expired 2026 dated records",
    expired2026,
    `All stored 2026 dates are before the ${auditDate} audit date.`,
  );
  printFindingGroup(
    "WARNING",
    "Records requiring next-cycle verification",
    nextCycleVerification,
    `Records are undated or all stored dates are before ${auditDate}.`,
  );
  printFindingGroup(
    "WARNING",
    "Not officially reverified",
    notReverified,
    "The migration source has not been checked against an official source for production.",
  );
  printFindingGroup(
    "WARNING",
    "Program/institution/country/call scope candidates",
    scopeCandidates,
    "Scope is inferred conservatively from rawText only; no formal scope field exists yet.",
  );

  console.log("");
  console.log("Policy checks (do not fail the audit)");
  printFindingGroup(
    "POLICY",
    "Automatic deadline rollover forbidden",
    automaticRolloverForbidden,
    "No record may have its date advanced automatically; every future cycle needs official verification.",
  );

  const structuralGroupCount = structuralGroups.filter((group) => group.size > 0).length;
  const warningGroupCount = warningGroups.filter((group) => group.size > 0).length;
  const failed = recordCountMismatch || structuralRecordIndices.size > 0;

  console.log("");
  console.log("Summary");
  console.log(`  As-of date: ${auditDate}`);
  console.log(`  Records audited: ${records.length}`);
  console.log(`  Structural finding groups: ${structuralGroupCount}`);
  console.log(`  Unique records with structural findings: ${structuralRecordIndices.size}`);
  console.log(`  Warning groups: ${warningGroupCount}`);
  console.log(`  Unique records with warnings: ${warningRecordIndices.size}`);
  console.log(`  Automatic-rollover-forbidden records: ${automaticRolloverForbidden.size}`);
  console.log(`Result: ${failed ? "FAILED" : "PASSED WITH WARNINGS"}`);

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`ERROR: Unexpected deadline audit failure: ${errorMessage(error)}`);
  process.exitCode = 1;
});
