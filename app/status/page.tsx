import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { getPublishedOpportunityCount } from "@/lib/catalogue/db-repository";
import { isDatabaseConfigured } from "@/lib/env";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Status",
  description: "Current ScholarTrack service status: catalogue availability and how to check it yourself.",
  path: "/status",
});

async function getCatalogueStatus(): Promise<{ ok: boolean; detail: string }> {
  if (!isDatabaseConfigured()) {
    return { ok: false, detail: "The database-backed catalogue is not configured on this deployment." };
  }
  try {
    const count = await getPublishedOpportunityCount();
    return { ok: true, detail: `Catalogue is reachable — ${count} published opportunities.` };
  } catch {
    return { ok: false, detail: "The catalogue database is currently unreachable." };
  }
}

export default async function StatusPage() {
  const catalogue = await getCatalogueStatus();

  return (
    <ContentPage title="Status" lastReviewed="Last reviewed for Checkpoint 6.">
      <Alert tone={catalogue.ok ? "success" : "danger"} title={catalogue.ok ? "Catalogue: operational" : "Catalogue: degraded"}>
        {catalogue.detail}
      </Alert>

      <ContentSection heading="What this page shows">
        <p>
          A live read of the public catalogue database at the moment you loaded this page. It does not track
          historical uptime or send any notification — for that, check back here or query the machine-readable
          endpoints below directly.
        </p>
      </ContentSection>

      <ContentSection heading="Machine-readable endpoints">
        <ul className="list-disc pl-5">
          <li>
            <code>/api/health</code> — public liveness check (always safe to call; never requires authentication).
          </li>
          <li>
            <code>/api/ready</code> — deeper readiness check (database connectivity and AI configuration status,
            without exposing any key).
          </li>
          <li>
            <code>/api/version</code> — current app version and environment name.
          </li>
        </ul>
        <p className="mt-2">None of these endpoints return secrets, internal error details, or private data.</p>
      </ContentSection>

      <ContentSection heading="Guest mode and PWA offline mode always work locally">
        <p>
          Guest mode, your local workspace, and the installed app&rsquo;s offline shell do not depend on the
          catalogue database being reachable at this moment — only fetching fresh published opportunities does. A
          previously visited catalogue page keeps working offline with a truthful &ldquo;last synced&rdquo; time.
        </p>
      </ContentSection>

      <ContentSection heading="Something look wrong?">
        <p>
          If the catalogue looks unavailable for you but this page reports operational, it may be a local network or
          browser issue — try reloading. For anything else, see{" "}
          <Link href="/contact" className="underline">
            Contact
          </Link>
          .
        </p>
      </ContentSection>
    </ContentPage>
  );
}
