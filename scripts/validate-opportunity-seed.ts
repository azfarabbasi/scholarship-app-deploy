import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import {
  deadlinePrecisionSchema,
  opportunitySeedSchema,
  type DeadlinePrecision,
  type OpportunitySeed,
} from "../src/lib/schemas/opportunity-seed";

const EXPECTED_RECORD_COUNT = 55;
const DATASET_RELATIVE_PATH = join(
  "data",
  "migrations",
  "v0.1",
  "scholarships.seed.json",
);

type JsonObject = Record<string, unknown>;

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
      if (!attemptedPaths.includes(candidate)) {
        attemptedPaths.push(candidate);

        if (await isReadableFile(candidate)) {
          return { datasetPath: candidate, attemptedPaths };
        }
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

function recordLabel(record: unknown, index: number): string {
  if (!isJsonObject(record)) {
    return `record ${index + 1}`;
  }

  const id = typeof record.legacyId === "number" ? record.legacyId : "?";
  const slug = typeof record.slug === "string" ? record.slug : "?";
  return `record ${index + 1} (legacyId: ${id}, slug: ${slug})`;
}

function collectFieldOccurrences<T extends string | number>(
  records: unknown[],
  field: "legacyId" | "slug" | "officialUrl",
  guard: (value: unknown) => value is T,
): Map<T, number[]> {
  const occurrences = new Map<T, number[]>();

  records.forEach((record, index) => {
    if (!isJsonObject(record)) {
      return;
    }

    const value = record[field];

    if (!guard(value)) {
      return;
    }

    const indices = occurrences.get(value) ?? [];
    indices.push(index + 1);
    occurrences.set(value, indices);
  });

  return occurrences;
}

function duplicateEntries<T extends string | number>(
  occurrences: Map<T, number[]>,
): Array<[T, number[]]> {
  return [...occurrences.entries()].filter(([, indices]) => indices.length > 1);
}

function printDuplicates<T extends string | number>(
  label: string,
  duplicates: Array<[T, number[]]>,
  severity: "ERROR" | "WARNING",
): void {
  duplicates.forEach(([value, records]) => {
    console.error(
      `${severity}: duplicate ${label} ${JSON.stringify(value)} in records ${records.join(", ")}`,
    );
  });
}

async function main(): Promise<void> {
  console.log("ScholarTrack opportunity seed validation");

  const { datasetPath, attemptedPaths } = await resolveDatasetPath();

  if (!(await isReadableFile(datasetPath))) {
    console.error(`ERROR: Could not find a readable seed dataset from ${process.cwd()}.`);
    console.error("Paths checked:");
    attemptedPaths.forEach((path) => console.error(`  - ${path}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Dataset: ${datasetPath}`);

  let fileContents: string;
  try {
    fileContents = await readFile(datasetPath, "utf8");
  } catch (error) {
    console.error(`ERROR: Could not read the seed dataset: ${errorMessage(error)}`);
    process.exitCode = 1;
    return;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fileContents) as unknown;
  } catch (error) {
    console.error(`ERROR: Seed dataset contains invalid JSON: ${errorMessage(error)}`);
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(parsedJson)) {
    console.error("ERROR: Seed dataset must be a top-level JSON array.");
    process.exitCode = 1;
    return;
  }

  const records = parsedJson;
  const validRecords: OpportunitySeed[] = [];
  let schemaIssueCount = 0;
  let invalidRecordCount = 0;

  records.forEach((record, index) => {
    const result = opportunitySeedSchema.safeParse(record);

    if (result.success) {
      validRecords.push(result.data);
      return;
    }

    invalidRecordCount += 1;
    schemaIssueCount += result.error.issues.length;
    console.error(`ERROR: Invalid ${recordLabel(record, index)}`);

    result.error.issues.forEach((issue) => {
      const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "<record>";
      console.error(`  - ${path}: ${issue.message}`);
    });
  });

  const legacyIdDuplicates = duplicateEntries(
    collectFieldOccurrences(records, "legacyId", (value): value is number =>
      typeof value === "number",
    ),
  );
  const slugDuplicates = duplicateEntries(
    collectFieldOccurrences(records, "slug", (value): value is string =>
      typeof value === "string",
    ),
  );
  const officialUrlDuplicates = duplicateEntries(
    collectFieldOccurrences(records, "officialUrl", (value): value is string =>
      typeof value === "string",
    ),
  );

  printDuplicates("legacyId", legacyIdDuplicates, "ERROR");
  printDuplicates("slug", slugDuplicates, "ERROR");
  printDuplicates("officialUrl", officialUrlDuplicates, "WARNING");

  const precisionCounts: Record<DeadlinePrecision, number> = {
    exact: 0,
    estimated: 0,
    rolling: 0,
    unknown: 0,
  };

  validRecords.forEach((record) => {
    precisionCounts[record.deadline.precision] += 1;
  });

  const criticalErrorCount =
    schemaIssueCount +
    (records.length === EXPECTED_RECORD_COUNT ? 0 : 1) +
    legacyIdDuplicates.length +
    slugDuplicates.length;

  console.log("");
  console.log("Summary");
  console.log(`  Records found: ${records.length} (expected ${EXPECTED_RECORD_COUNT})`);
  console.log(`  Schema-valid records: ${validRecords.length}`);
  console.log(`  Schema-invalid records: ${invalidRecordCount}`);
  console.log(`  Schema issues: ${schemaIssueCount}`);
  console.log("  Deadline precision (schema-valid records):");

  deadlinePrecisionSchema.options.forEach((precision) => {
    console.log(`    ${precision}: ${precisionCounts[precision]}`);
  });

  console.log(`  Duplicate legacyId groups: ${legacyIdDuplicates.length}`);
  console.log(`  Duplicate slug groups: ${slugDuplicates.length}`);
  console.log(`  Duplicate officialUrl groups (warnings): ${officialUrlDuplicates.length}`);
  console.log(`  Critical errors: ${criticalErrorCount}`);

  if (criticalErrorCount > 0) {
    if (records.length !== EXPECTED_RECORD_COUNT) {
      console.error(
        `ERROR: Expected exactly ${EXPECTED_RECORD_COUNT} records, found ${records.length}.`,
      );
    }

    console.error("Result: FAILED");
    process.exitCode = 1;
    return;
  }

  console.log("Result: PASSED");
}

main().catch((error: unknown) => {
  console.error(`ERROR: Unexpected validator failure: ${errorMessage(error)}`);
  process.exitCode = 1;
});
