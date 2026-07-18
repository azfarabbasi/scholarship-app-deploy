import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { isAdsConfigured } from "@/lib/env";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Advertising policy",
  description: "Whether ScholarTrack shows ads, how they're separated from content, and what they never influence.",
  path: "/advertising-policy",
});

export default function AdvertisingPolicyPage() {
  const adsEnabled = isAdsConfigured();

  return (
    <ContentPage title="Advertising policy" lastReviewed="Last reviewed for Checkpoint 6.">
      <ContentSection heading="Current status">
        <p>
          Advertising is currently <strong>{adsEnabled ? "enabled" : "disabled"}</strong> on this deployment. Ads are
          off by default in ScholarTrack and only ever appear when a deployment explicitly configures and enables
          them.
        </p>
      </ContentSection>

      <ContentSection heading="Ads never influence what you see">
        <ul className="list-disc pl-5">
          <li>Ads never affect catalogue search ranking or sort order.</li>
          <li>Ads never affect deterministic match labels or eligibility evaluation.</li>
          <li>Ads never appear inside AI assistant answers, and never influence what the assistant says.</li>
          <li>Ads are never disguised as an official scholarship or internship link.</li>
          <li>Ads never appear on authentication, account deletion, privacy, security, or any staff page.</li>
          <li>Ads never appear inside a form you&rsquo;re actively filling in (correction reports, eligibility questionnaire, sign-up/sign-in).</li>
        </ul>
      </ContentSection>

      <ContentSection heading="Visual separation">
        <p>
          Whenever an ad slot is shown, it is visually distinct from catalogue content and clearly labelled
          &ldquo;Advertisement&rdquo; for screen-reader and sighted users alike — never blended into the surrounding
          list of opportunities.
        </p>
      </ContentSection>

      <ContentSection heading="Where an ad slot may appear">
        <p>
          If enabled, ad placements are limited to non-intrusive locations: an inline slot after several catalogue
          results, the site footer, and article-style pages like this one and the FAQ. No ad ever appears inside the
          opportunity detail page&rsquo;s core facts, the AI assistant panel, or any workspace/account page.
        </p>
      </ContentSection>

      <ContentSection heading="If AdSense is configured later">
        <p>
          ScholarTrack&rsquo;s ad configuration is prepared to support Google AdSense as one possible provider. A
          publisher ID is never required for the app to build or run, and no AdSense approval is assumed or claimed
          by this page — see{" "}
          <Link href="/methodology" className="underline">
            Methodology
          </Link>{" "}
          for how ranking and matching work independent of any ad provider.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
