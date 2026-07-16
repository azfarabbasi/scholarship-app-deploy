/**
 * Idempotent taxonomy seed. Safe to run repeatedly — every insert is
 * `onConflictDoNothing` against the table's unique `code` (or `iso_alpha2_code`
 * for countries), so re-running never duplicates or overwrites a row a
 * reviewer has since edited.
 *
 * Country/region membership and the ten opportunity-type codes are ordinary,
 * publicly known reference facts (ISO-3166 codes, EU membership, the fixed
 * type vocabulary from `src/lib/domain/opportunity.ts`) — not scholarship
 * facts, so they need no official-source citation. Document/funding/field
 * taxonomies are generic category labels, drawn from the Checkpoint 2 brief's
 * own example lists, not claims about any specific opportunity.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { OPPORTUNITY_TYPES } from "../src/lib/domain/opportunity";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

const OPPORTUNITY_TYPE_LABELS: Record<(typeof OPPORTUNITY_TYPES)[number], string> = {
  scholarship: "Scholarship",
  "partial-scholarship": "Partial scholarship",
  internship: "Internship",
  fellowship: "Fellowship",
  exchange: "Exchange programme",
  "research-placement": "Research placement",
  grant: "Grant",
  competition: "Competition",
  conference: "Conference",
  "summer-school": "Summer school",
};

const STUDY_LEVELS = [
  { code: "Bachelor", label: "Bachelor", sortOrder: 1 },
  { code: "Master", label: "Master", sortOrder: 2 },
  { code: "PhD", label: "PhD", sortOrder: 3 },
  { code: "Postdoc", label: "Postdoc", sortOrder: 4 },
  { code: "Research", label: "Research", sortOrder: 5 },
  { code: "Exchange", label: "Exchange", sortOrder: 6 },
];

// ISO-3166-1 alpha-2/alpha-3 codes. The 16 marked EU cover every country the
// v0.1 migration seed references; the rest are common destinations staff are
// likely to add opportunities for.
const COUNTRIES: { alpha2: string; alpha3: string; name: string; eu: boolean }[] = [
  { alpha2: "AT", alpha3: "AUT", name: "Austria", eu: true },
  { alpha2: "BE", alpha3: "BEL", name: "Belgium", eu: true },
  { alpha2: "BG", alpha3: "BGR", name: "Bulgaria", eu: true },
  { alpha2: "HR", alpha3: "HRV", name: "Croatia", eu: true },
  { alpha2: "CY", alpha3: "CYP", name: "Cyprus", eu: true },
  { alpha2: "CZ", alpha3: "CZE", name: "Czech Republic", eu: true },
  { alpha2: "DK", alpha3: "DNK", name: "Denmark", eu: true },
  { alpha2: "EE", alpha3: "EST", name: "Estonia", eu: true },
  { alpha2: "FI", alpha3: "FIN", name: "Finland", eu: true },
  { alpha2: "FR", alpha3: "FRA", name: "France", eu: true },
  { alpha2: "DE", alpha3: "DEU", name: "Germany", eu: true },
  { alpha2: "GR", alpha3: "GRC", name: "Greece", eu: true },
  { alpha2: "HU", alpha3: "HUN", name: "Hungary", eu: true },
  { alpha2: "IE", alpha3: "IRL", name: "Ireland", eu: true },
  { alpha2: "IT", alpha3: "ITA", name: "Italy", eu: true },
  { alpha2: "LV", alpha3: "LVA", name: "Latvia", eu: true },
  { alpha2: "LT", alpha3: "LTU", name: "Lithuania", eu: true },
  { alpha2: "LU", alpha3: "LUX", name: "Luxembourg", eu: true },
  { alpha2: "MT", alpha3: "MLT", name: "Malta", eu: true },
  { alpha2: "NL", alpha3: "NLD", name: "Netherlands", eu: true },
  { alpha2: "PL", alpha3: "POL", name: "Poland", eu: true },
  { alpha2: "PT", alpha3: "PRT", name: "Portugal", eu: true },
  { alpha2: "RO", alpha3: "ROU", name: "Romania", eu: true },
  { alpha2: "SK", alpha3: "SVK", name: "Slovakia", eu: true },
  { alpha2: "SI", alpha3: "SVN", name: "Slovenia", eu: true },
  { alpha2: "ES", alpha3: "ESP", name: "Spain", eu: true },
  { alpha2: "SE", alpha3: "SWE", name: "Sweden", eu: true },
  { alpha2: "NO", alpha3: "NOR", name: "Norway", eu: false },
  { alpha2: "CH", alpha3: "CHE", name: "Switzerland", eu: false },
  { alpha2: "GB", alpha3: "GBR", name: "United Kingdom", eu: false },
  { alpha2: "US", alpha3: "USA", name: "United States", eu: false },
  { alpha2: "CA", alpha3: "CAN", name: "Canada", eu: false },
  { alpha2: "AU", alpha3: "AUS", name: "Australia", eu: false },
  { alpha2: "JP", alpha3: "JPN", name: "Japan", eu: false },
  { alpha2: "IN", alpha3: "IND", name: "India", eu: false },
  { alpha2: "CN", alpha3: "CHN", name: "China", eu: false },
];

const FUNDING_TYPES = [
  { code: "full", label: "Full funding", description: "Covers tuition and living costs." },
  { code: "partial", label: "Partial funding", description: "Covers part of tuition or living costs." },
  { code: "tuition-only", label: "Tuition only", description: "Covers tuition fees only." },
  { code: "stipend-only", label: "Stipend only", description: "A living-cost stipend without tuition coverage." },
  { code: "reimbursement", label: "Reimbursement", description: "Costs are reimbursed after being incurred." },
  { code: "in-kind", label: "In-kind support", description: "Non-cash support such as housing or equipment." },
  { code: "unspecified", label: "Unspecified", description: "Funding type not yet documented by an official source." },
];

const FIELDS_OF_STUDY = [
  { code: "stem", label: "STEM" },
  { code: "social-sciences", label: "Social sciences" },
  { code: "humanities", label: "Humanities" },
  { code: "business-economics", label: "Business & economics" },
  { code: "medicine-health", label: "Medicine & health" },
  { code: "law", label: "Law" },
  { code: "arts-design", label: "Arts & design" },
  { code: "education", label: "Education" },
  { code: "other", label: "Other / interdisciplinary" },
];

const DOCUMENT_TEMPLATES = [
  { code: "identity-document", label: "Identity document", category: "identity-proof" as const },
  { code: "academic-transcript", label: "Academic transcript", category: "academic-record" as const },
  { code: "degree-certificate", label: "Degree certificate", category: "qualification" as const },
  { code: "language-certificate", label: "Language certificate", category: "language-test" as const },
  { code: "recommendation-letter", label: "Recommendation letter", category: "reference" as const },
  { code: "cv-resume", label: "CV / résumé", category: "curriculum-vitae" as const },
  { code: "personal-statement", label: "Personal statement", category: "personal-statement" as const },
  { code: "research-proposal", label: "Research proposal", category: "research-proposal" as const },
  { code: "proof-of-admission", label: "Proof of admission", category: "qualification" as const },
  { code: "financial-document", label: "Financial document", category: "other" as const },
];

async function main() {
  const client = postgres(connectionString as string, { max: 1 });
  const db = drizzle(client, { schema });

  await db.insert(schema.opportunityTypes).values(
    OPPORTUNITY_TYPES.map((code, index) => ({
      code,
      label: OPPORTUNITY_TYPE_LABELS[code],
      sortOrder: index,
      status: "active" as const,
    })),
  ).onConflictDoNothing({ target: schema.opportunityTypes.code });

  await db.insert(schema.studyLevels).values(
    STUDY_LEVELS.map((level) => ({ ...level, status: "active" as const })),
  ).onConflictDoNothing({ target: schema.studyLevels.code });

  await db.insert(schema.countries).values(
    COUNTRIES.map((country) => ({
      isoAlpha2Code: country.alpha2,
      isoAlpha3Code: country.alpha3,
      name: country.name,
      status: "active" as const,
    })),
  ).onConflictDoNothing({ target: schema.countries.isoAlpha2Code });

  const [euRegion] = await db
    .insert(schema.regions)
    .values({ code: "EU", name: "European Union", status: "active" })
    .onConflictDoNothing({ target: schema.regions.code })
    .returning();

  const region = euRegion ?? (await db.select().from(schema.regions).where(eq(schema.regions.code, "EU")))[0];
  if (region) {
    const euCountries = await db.select().from(schema.countries);
    const memberIds = euCountries.filter((c) => COUNTRIES.find((seed) => seed.alpha2 === c.isoAlpha2Code)?.eu).map((c) => c.id);
    if (memberIds.length > 0) {
      await db
        .insert(schema.regionCountries)
        .values(memberIds.map((countryId) => ({ regionId: region.id, countryId })))
        .onConflictDoNothing();
    }
  }

  await db.insert(schema.fundingTypes).values(
    FUNDING_TYPES.map((type) => ({ ...type, status: "active" as const })),
  ).onConflictDoNothing({ target: schema.fundingTypes.code });

  await db.insert(schema.fieldsOfStudy).values(
    FIELDS_OF_STUDY.map((field) => ({ ...field, status: "active" as const })),
  ).onConflictDoNothing({ target: schema.fieldsOfStudy.code });

  await db.insert(schema.requiredDocumentTemplates).values(
    DOCUMENT_TEMPLATES.map((template) => ({ ...template, status: "active" as const })),
  ).onConflictDoNothing({ target: schema.requiredDocumentTemplates.code });

  console.log("Taxonomies seeded (idempotent): opportunity types, study levels, countries, EU region, funding types, fields of study, document templates.");
  await client.end();
}

main().catch((error: unknown) => {
  console.error("Taxonomy seed failed:", error);
  process.exit(1);
});
