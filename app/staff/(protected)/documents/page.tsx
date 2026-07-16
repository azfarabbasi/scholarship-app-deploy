import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { CreateTaxonomyValueForm } from "@/components/staff/CreateTaxonomyValueForm";

export default async function StaffDocumentsPage() {
  const db = getDb();
  const templates = await db.select().from(schema.requiredDocumentTemplates).orderBy(asc(schema.requiredDocumentTemplates.label));

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">Required-document templates</h1>
      <p className="text-sm text-foreground-muted">
        These are reusable document <em>categories</em> — never a file upload. Attach one to a specific opportunity
        (with a source and required/optional level) from that opportunity&rsquo;s page.
      </p>
      <ul className="rounded-lg border border-border divide-y divide-border">
        {templates.map((template) => (
          <li key={template.id} className="px-3 py-2 text-sm">
            <span className="font-medium text-foreground">{template.label}</span>{" "}
            <span className="text-foreground-muted">— {template.category}</span>
          </li>
        ))}
      </ul>
      <CreateTaxonomyValueForm kind="document-template" label="document template" />
    </div>
  );
}
