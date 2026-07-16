import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { CreateOrganisationForm, CreateProviderForm } from "@/components/staff/OrganisationForms";

export default async function StaffOrganisationsPage() {
  const db = getDb();
  const [organisations, providers] = await Promise.all([
    db.select().from(schema.organisations).orderBy(asc(schema.organisations.displayName)),
    db
      .select({ id: schema.providers.id, displayName: schema.providers.displayName, organisationName: schema.organisations.displayName, status: schema.providers.status })
      .from(schema.providers)
      .innerJoin(schema.organisations, eq(schema.providers.organisationId, schema.organisations.id))
      .orderBy(asc(schema.providers.displayName)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Organisations &amp; providers</h1>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Organisations ({organisations.length})</h2>
          <ul className="mb-3 max-h-64 overflow-y-auto text-sm text-foreground-muted">
            {organisations.map((o) => (
              <li key={o.id}>
                {o.displayName} — {o.kind} ({o.status})
              </li>
            ))}
          </ul>
          <CreateOrganisationForm />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Providers ({providers.length})</h2>
          <ul className="mb-3 max-h-64 overflow-y-auto text-sm text-foreground-muted">
            {providers.map((p) => (
              <li key={p.id}>
                {p.displayName} — {p.organisationName} ({p.status})
              </li>
            ))}
          </ul>
          <CreateProviderForm organisations={organisations.map((o) => ({ id: o.id, label: o.displayName }))} />
        </div>
      </section>
    </div>
  );
}
