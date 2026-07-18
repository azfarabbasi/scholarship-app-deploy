import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Disclaimer",
  description: "What ScholarTrack does and doesn't guarantee about catalogue data, matching, and the AI assistant.",
  path: "/disclaimer",
});

export default function DisclaimerPage() {
  return (
    <ContentPage title="Disclaimer" lastReviewed="Last reviewed for Checkpoint 6.">
      <ContentSection heading="Not an official or affiliated source">
        <p>
          ScholarTrack is an independent planning tool. It is not operated by, endorsed by, or affiliated with any
          government, university, or scholarship/internship provider referenced in the catalogue. Every listing links
          to (or names) an official source — that source, not ScholarTrack, is authoritative.
        </p>
      </ContentSection>

      <ContentSection heading="Information accuracy">
        <p>
          Catalogue information is staff-reviewed at the time it is published or last checked, but programmes change
          their deadlines, funding, and eligibility rules without notice. Always confirm current details on the
          official source before making a decision or applying. See{" "}
          <Link href="/verification-policy" className="underline">
            Verification policy
          </Link>{" "}
          for exactly what &ldquo;verified&rdquo; and &ldquo;last checked&rdquo; mean here.
        </p>
      </ContentSection>

      <ContentSection heading="Not legal, financial, immigration, or admissions advice">
        <p>
          Nothing on ScholarTrack constitutes legal, financial, immigration, tax, or university-admissions advice.
          For decisions with real consequences (visas, funding commitments, enrollment), consult the official
          provider or a qualified professional.
        </p>
      </ContentSection>

      <ContentSection heading="Match labels are a planning aid, not a decision">
        <p>
          Match labels (e.g. &ldquo;Strong potential fit,&rdquo; &ldquo;Needs verification&rdquo;) are produced by a
          deterministic rule engine comparing your optional eligibility answers to an opportunity&rsquo;s structured
          rules. They are never a final eligibility, admission, or funding decision, and they can be wrong if the
          underlying rule data is incomplete or your answers don&rsquo;t capture your full situation.
        </p>
      </ContentSection>

      <ContentSection heading="The AI assistant is not a final authority">
        <p>
          The optional AI assistant answers only from ScholarTrack&rsquo;s own stored, staff-approved data, with
          citations. It is a language model and can still misinterpret a question or a source excerpt; it is never a
          substitute for reading the official source yourself, and it never overrides the deterministic match label
          above.
        </p>
      </ContentSection>

      <ContentSection heading="No liability for third-party sites">
        <p>
          Official-source links lead to third-party websites ScholarTrack does not control and is not responsible
          for. Their content, availability, and application processes are entirely their own.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
