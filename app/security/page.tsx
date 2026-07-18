import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { getContactEmails } from "@/lib/env";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Security",
  description: "ScholarTrack's security posture and how to report a vulnerability responsibly.",
  path: "/security",
});

export default function SecurityPage() {
  const emails = getContactEmails();

  return (
    <ContentPage title="Security" lastReviewed="Last reviewed for Checkpoint 6.">
      <ContentSection heading="Reporting a vulnerability">
        <p>
          {emails.security ? (
            <>
              Please email <a href={`mailto:${emails.security}`} className="underline">{emails.security}</a> with
              details — what you found, how to reproduce it, and its potential impact. We ask that you don&rsquo;t
              publicly disclose a vulnerability before it has been addressed.
            </>
          ) : (
            "A dedicated security contact address is not configured on this deployment yet. In the meantime, use the general contact channel and mark your message as security-sensitive."
          )}
        </p>
        <p className="mt-2">
          Please don&rsquo;t test against real student accounts you don&rsquo;t own, attempt to access another
          person&rsquo;s data, or run automated scans that could degrade the service for real users.
        </p>
      </ContentSection>

      <ContentSection heading="What we do">
        <ul className="list-disc pl-5">
          <li>Row Level Security on every database table, independent of the application&rsquo;s own authorization checks.</li>
          <li>A strict, nonce-based Content-Security-Policy, HTTPS enforcement (HSTS) in production, and standard anti-clickjacking/anti-sniffing headers.</li>
          <li>Every staff/account/AI-private route is rejected for an unauthenticated visitor server-side, not just hidden in navigation.</li>
          <li>Rate limiting on the AI assistant, correction reports, and other public write endpoints.</li>
          <li>Automated scanning for accidentally committed secrets before code is treated as ready to ship.</li>
          <li>No sensitive document upload capability anywhere in the product — see{" "}
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
            .
          </li>
        </ul>
      </ContentSection>

      <ContentSection heading="Data handling">
        <p>
          Server-only credentials (database, Supabase secret key, AI provider key) never reach browser JavaScript.
          See{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>{" "}
          for what data is collected and how it&rsquo;s stored.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
