import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Terms of use",
  description: "The terms governing your use of ScholarTrack as a guest or account holder.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <ContentPage title="Terms of use" lastReviewed="Last reviewed for Checkpoint 6.">
      <ContentSection heading="Acceptance">
        <p>By using ScholarTrack, you agree to these terms. If you don&rsquo;t agree, please don&rsquo;t use the site.</p>
      </ContentSection>

      <ContentSection heading="A planning tool, not an authority">
        <p>
          ScholarTrack is a discovery and planning tool. It is not affiliated with any government, university, or
          scholarship provider listed in the catalogue. Deadlines, eligibility, funding amounts, and required
          documents must be independently verified on the official source before you rely on them or apply — see{" "}
          <Link href="/disclaimer" className="underline">
            Disclaimer
          </Link>
          .
        </p>
      </ContentSection>

      <ContentSection heading="No autonomous applications">
        <p>
          ScholarTrack never submits a scholarship or internship application on your behalf, automatically or
          otherwise. Every application step remains something you do yourself, on the official provider&rsquo;s own
          website or process.
        </p>
      </ContentSection>

      <ContentSection heading="Accounts">
        <p>
          An account is optional and used only to sync your personal workspace across devices. You are responsible
          for keeping your account credentials secure. You may delete your account and its cloud data at any time
          from Account → Delete data.
        </p>
      </ContentSection>

      <ContentSection heading="Acceptable use">
        <ul className="list-disc pl-5">
          <li>Don&rsquo;t attempt to bypass rate limits, scrape the site at scale, or automate abusive traffic.</li>
          <li>Don&rsquo;t submit false correction reports, spam, or attempt to inject content into staff-reviewed data.</li>
          <li>Don&rsquo;t attempt to access another person&rsquo;s account, workspace, or private data.</li>
          <li>Don&rsquo;t upload sensitive documents — ScholarTrack has nowhere designed to receive them.</li>
        </ul>
      </ContentSection>

      <ContentSection heading="No warranty">
        <p>
          ScholarTrack is provided as-is. Catalogue information, match labels, and AI assistant answers are provided
          for planning purposes only and without warranty of accuracy, completeness, or fitness for a particular
          purpose. See{" "}
          <Link href="/disclaimer" className="underline">
            Disclaimer
          </Link>{" "}
          for the full scope of this limitation.
        </p>
      </ContentSection>

      <ContentSection heading="Changes">
        <p>These terms may be updated as the product evolves; the &ldquo;last reviewed&rdquo; date above reflects the most recent revision.</p>
      </ContentSection>

      <ContentSection heading="Contact">
        <p>
          Questions about these terms can be sent through{" "}
          <Link href="/contact" className="underline">
            Contact
          </Link>
          .
        </p>
      </ContentSection>
    </ContentPage>
  );
}
