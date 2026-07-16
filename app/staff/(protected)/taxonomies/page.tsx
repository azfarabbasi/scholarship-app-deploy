import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { CreateTaxonomyValueForm } from "@/components/staff/CreateTaxonomyValueForm";

export default async function StaffTaxonomiesPage() {
  const db = getDb();
  const [regions, studyLevels, fieldsOfStudy, fundingTypes, opportunityTypes, countries] = await Promise.all([
    db.select().from(schema.regions).orderBy(asc(schema.regions.name)),
    db.select().from(schema.studyLevels).orderBy(asc(schema.studyLevels.sortOrder)),
    db.select().from(schema.fieldsOfStudy).orderBy(asc(schema.fieldsOfStudy.label)),
    db.select().from(schema.fundingTypes).orderBy(asc(schema.fundingTypes.label)),
    db.select().from(schema.opportunityTypes).orderBy(asc(schema.opportunityTypes.sortOrder)),
    db.select().from(schema.countries).orderBy(asc(schema.countries.name)),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <h1 className="text-xl font-semibold text-foreground">Taxonomies</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Opportunity types ({opportunityTypes.length}, fixed)</h2>
        <p className="text-sm text-foreground-muted">{opportunityTypes.map((t) => t.label).join(", ")}</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Countries ({countries.length})</h2>
        <p className="mb-2 text-sm text-foreground-muted">{countries.map((c) => c.name).join(", ")}</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Regions ({regions.length})</h2>
        <p className="mb-2 text-sm text-foreground-muted">{regions.map((r) => r.name).join(", ") || "None yet."}</p>
        <CreateTaxonomyValueForm kind="region" label="region" />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Study levels ({studyLevels.length})</h2>
        <p className="mb-2 text-sm text-foreground-muted">{studyLevels.map((s) => s.label).join(", ")}</p>
        <CreateTaxonomyValueForm kind="study-level" label="study level" />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Fields of study ({fieldsOfStudy.length})</h2>
        <p className="mb-2 text-sm text-foreground-muted">{fieldsOfStudy.map((f) => f.label).join(", ")}</p>
        <CreateTaxonomyValueForm kind="field-of-study" label="field of study" />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Funding types ({fundingTypes.length})</h2>
        <p className="mb-2 text-sm text-foreground-muted">{fundingTypes.map((f) => f.label).join(", ")}</p>
        <CreateTaxonomyValueForm kind="funding-type" label="funding type" />
      </section>
    </div>
  );
}
