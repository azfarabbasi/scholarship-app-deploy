import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Verification policy",
  description: "What ScholarTrack's deadline precision and verification statuses actually mean.",
  path: "/verification-policy",
});

export default function VerificationPolicyPage() {
  return (
    <ContentPage title="Verification policy" lastReviewed="Last reviewed for Checkpoint 6.">
      <ContentSection heading="Why this exists">
        <p>
          Not every scholarship or internship publishes a deadline the same way. Some are exact and confirmed;
          others are estimated from a previous cycle, roll continuously, or aren&rsquo;t announced yet. ScholarTrack
          shows you which situation you&rsquo;re in instead of flattening everything into one date.
        </p>
      </ContentSection>

      <ContentSection heading="Precision levels">
        <ul className="list-disc pl-5">
          <li><strong>Exact</strong> — a specific calendar date confirmed by the official source.</li>
          <li><strong>Estimated</strong> — a projected date based on a previous cycle&rsquo;s pattern, not yet confirmed for the current one.</li>
          <li><strong>Rolling</strong> — applications are accepted continuously, with no fixed cutoff.</li>
          <li><strong>Unknown</strong> — the official source hasn&rsquo;t published a deadline yet.</li>
          <li><strong>Program-specific / institution-specific</strong> — the deadline depends on the specific programme or institution within a broader scheme, and isn&rsquo;t one universal date.</li>
        </ul>
      </ContentSection>

      <ContentSection heading="Verification statuses">
        <ul className="list-disc pl-5">
          <li><strong>Verified</strong> — independently confirmed against the official source as of the &ldquo;last checked&rdquo; date.</li>
          <li><strong>Unverified</strong> — recorded, but not yet independently confirmed.</li>
          <li><strong>Estimated from previous cycle</strong> — based on last cycle&rsquo;s date, explicitly flagged as not yet confirmed for this cycle.</li>
          <li><strong>Stale</strong> — was verified once, but enough time has passed that it needs re-checking.</li>
          <li><strong>Conflicting</strong> — different sources disagree, and staff haven&rsquo;t resolved it yet.</li>
          <li><strong>Withdrawn / Archived</strong> — the programme has been withdrawn or the record archived; it is no longer presented as currently open.</li>
        </ul>
      </ContentSection>

      <ContentSection heading="When you see a countdown">
        <p>
          A live countdown is shown only when a deadline is <strong>exact</strong>, <strong>verified</strong>, and its
          source timezone is known. Anything else shows a plain-language status instead (e.g. &ldquo;Verify
          deadline&rdquo; or &ldquo;Deadline estimate only&rdquo;) rather than a false sense of precision.
        </p>
      </ContentSection>

      <ContentSection heading="Always confirm before you rely on it">
        <p>
          Regardless of status, confirm current deadlines and eligibility on the official source before making a
          decision. See{" "}
          <Link href="/data-sources" className="underline">
            Data sources
          </Link>{" "}
          for how records get into the catalogue in the first place, and use &ldquo;Report incorrect
          information&rdquo; on any opportunity&rsquo;s page if something looks wrong.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
