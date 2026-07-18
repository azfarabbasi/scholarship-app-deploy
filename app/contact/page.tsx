import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { getContactEmails } from "@/lib/env";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description: "How to reach ScholarTrack for feedback, support, security reports, and data corrections.",
  path: "/contact",
});

export default function ContactPage() {
  const emails = getContactEmails();

  return (
    <ContentPage title="Contact" lastReviewed="Last reviewed for Checkpoint 6.">
      <ContentSection heading="Incorrect catalogue information">
        <p>
          Found a wrong deadline, broken link, or outdated eligibility rule? Use the &ldquo;Report incorrect
          information&rdquo; button on the opportunity&rsquo;s own detail page — staff triage every report. This is
          the fastest path for catalogue corrections specifically.
        </p>
      </ContentSection>

      <ContentSection heading="General feedback and support">
        <p>
          {emails.support ? (
            <>
              Email <a href={`mailto:${emails.support}`} className="underline">{emails.support}</a> for account or
              product support.
            </>
          ) : emails.feedback ? (
            <>
              Email <a href={`mailto:${emails.feedback}`} className="underline">{emails.feedback}</a> with feedback or
              questions.
            </>
          ) : (
            "A support address is not configured on this deployment yet. Use the in-app feedback option under Settings → Feedback in the meantime."
          )}
        </p>
      </ContentSection>

      <ContentSection heading="Security reports">
        <p>
          {emails.security ? (
            <>
              Please report a suspected security vulnerability to{" "}
              <a href={`mailto:${emails.security}`} className="underline">
                {emails.security}
              </a>{" "}
              rather than a public issue — see{" "}
              <Link href="/security" className="underline">
                Security
              </Link>{" "}
              for full details.
            </>
          ) : (
            <>
              A dedicated security contact is not configured on this deployment yet — see{" "}
              <Link href="/security" className="underline">
                Security
              </Link>{" "}
              for the current reporting process.
            </>
          )}
        </p>
      </ContentSection>

      <ContentSection heading="What we can't help with">
        <p>
          ScholarTrack cannot make eligibility, admission, or funding decisions on behalf of any programme, and
          cannot expedite or influence an application submitted directly to a provider&rsquo;s own official site.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
