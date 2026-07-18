import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "About ScholarTrack",
  description: "What ScholarTrack is, who it's for, and the planning-tool philosophy behind it.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <ContentPage title="About ScholarTrack" lastReviewed="Last reviewed for Checkpoint 6.">
      <ContentSection heading="What ScholarTrack is">
        <p>
          ScholarTrack is a planning and discovery tool for scholarship and internship opportunities. It helps you
          browse a staff-reviewed catalogue, understand which deadlines are reliable versus estimated, and organise
          your own applications — shortlist, stages, notes, checklists, and personal deadlines.
        </p>
      </ContentSection>

      <ContentSection heading="What ScholarTrack is not">
        <p>
          ScholarTrack is not an official government, university, or scholarship-provider service, and it does not
          submit applications on your behalf. It is not a substitute for reading the official rules of a programme
          you&rsquo;re applying to. Deadlines, eligibility, and funding details must always be verified on the
          official source before you rely on them — see{" "}
          <Link href="/verification-policy" className="underline">
            Verification policy
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="Guest-first by design">
        <p>
          You can use the full catalogue, workspace, calendar, and planning tools without ever creating an account —
          your data stays on your device. An account is entirely optional and only exists to sync your workspace
          across devices. See{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="Deterministic matching, source-grounded AI">
        <p>
          Match labels are produced by a fixed, human-authored rule engine — never AI. The optional AI assistant only
          answers from ScholarTrack&rsquo;s own stored, staff-approved data, always with citations, and is never a
          final eligibility, admission, or funding authority. See{" "}
          <Link href="/methodology" className="underline">
            Methodology
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="No sensitive document uploads">
        <p>
          ScholarTrack does not accept uploads of passports, transcripts, financial documents, or any other sensitive
          files, for guests or account holders. This is a deliberate, permanent product boundary.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
