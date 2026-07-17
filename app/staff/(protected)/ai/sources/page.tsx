import { AiSourceDocumentsManager } from "@/components/staff/AiSourceDocumentsManager";
import { listAiSourceDocuments } from "@/lib/db/actions/ai-staff";
import { canApproveAiSources } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getPublishedOpportunities } from "@/lib/catalogue/db-repository";

export default async function StaffAiSourcesPage() {
  const session = await getStaffSession();
  const [documents, opportunities] = await Promise.all([listAiSourceDocuments(), getPublishedOpportunities()]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">AI sources</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Manually entered, plain-text excerpts of official-source content — never a file upload. Being linked or
          chunked never implies approval; only an explicit approval makes an excerpt usable by the public assistant.
        </p>
      </div>

      <AiSourceDocumentsManager
        documents={documents}
        opportunities={opportunities.map((o) => ({ id: o.id, title: o.title }))}
        canApprove={Boolean(session && canApproveAiSources(session.roles))}
      />
    </div>
  );
}
