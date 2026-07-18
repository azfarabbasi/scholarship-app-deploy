import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Methodology",
  description: "How ScholarTrack curates data, evaluates deadlines, computes match labels, and grounds AI answers.",
  path: "/methodology",
});

export default function MethodologyPage() {
  return (
    <ContentPage title="Methodology" lastReviewed="Last reviewed for Checkpoint 6.">
      <ContentSection heading="1. Data curation">
        <p>
          Every catalogue record is entered and reviewed by staff through a draft → review → approve → publish
          workflow with separation of duties (the person who drafts a record cannot approve it themselves). A record
          cannot be published without a linked official source and a verification status. See{" "}
          <Link href="/data-sources" className="underline">
            Data sources
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="2. Deadline intelligence">
        <p>
          Deadlines are never treated as one uniform fact. ScholarTrack distinguishes exact, estimated, rolling,
          unknown, program-specific, and institution-specific deadlines, and shows a countdown only when a deadline
          is verified, exact, and its timezone is known. See{" "}
          <Link href="/verification-policy" className="underline">
            Verification policy
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="3. Deterministic matching — never AI">
        <p>
          The optional eligibility questionnaire feeds a fixed, human-authored rule engine that compares your answers
          against an opportunity&rsquo;s structured eligibility rules and deadline data. It produces a cautious label
          (e.g. &ldquo;Strong potential fit,&rdquo; &ldquo;Needs verification&rdquo;) with the specific reasons
          behind it — always a planning aid, never a final eligibility, admission, or funding decision, and no
          machine-learning model is involved anywhere in this comparison.
        </p>
      </ContentSection>

      <ContentSection heading="4. Search and ranking">
        <p>
          Catalogue search uses a typo-tolerant, relevance-ranked scorer (client-side and a database-backed
          <code className="mx-1 rounded bg-surface-muted px-1 py-0.5 text-xs">/api/search</code>
          route). Ranking is based only on textual relevance to your query and filters you choose — never on
          advertising, sponsorship, or any paid placement. See{" "}
          <Link href="/advertising-policy" className="underline">
            Advertising policy
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="5. Source-grounded AI assistant">
        <p>
          When enabled, the AI assistant answers only from ScholarTrack&rsquo;s own stored, staff-approved source
          excerpts and the same structured catalogue data described above — never live web browsing, never
          invented facts. Every factual answer is cited; if nothing supports a claim, the assistant says so instead
          of guessing. It never overrides the deterministic match label above — it may only explain it in plain
          language.
        </p>
      </ContentSection>

      <ContentSection heading="6. Corrections keep the catalogue honest">
        <p>
          Anyone can report a suspected error on any opportunity&rsquo;s detail page. Staff triage every report before
          anything changes on the public listing — nothing is auto-corrected from a public submission.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
