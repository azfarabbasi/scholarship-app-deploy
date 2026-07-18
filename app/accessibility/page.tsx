import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, ContentSection } from "@/components/common/ContentPage";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Accessibility",
  description: "ScholarTrack's accessibility commitment, supported features, and known gaps.",
  path: "/accessibility",
});

export default function AccessibilityPage() {
  return (
    <ContentPage title="Accessibility" lastReviewed="Last reviewed for Checkpoint 6.">
      <ContentSection heading="Our commitment">
        <p>
          ScholarTrack targets WCAG 2.1 level AA across public and account pages. Automated checks (axe-core) run
          against major pages as part of every release, and the product is regularly exercised with a keyboard only
          and with screen readers.
        </p>
      </ContentSection>

      <ContentSection heading="Supported features">
        <ul className="list-disc pl-5">
          <li>A skip link that is the first tab stop on every page, moving focus straight into the main content.</li>
          <li>Consistent landmark regions (header, main, footer) and a logical heading order.</li>
          <li>All interactive controls are keyboard-operable, with visible focus outlines and managed focus after dialogs and major actions.</li>
          <li>Status information (deadline states, match labels, sync status) is never colour-only — it always pairs with text or an icon.</li>
          <li>Light, dark, and system theme, with adequate colour contrast in both.</li>
          <li><code>prefers-reduced-motion</code> is respected; transitions are minimised for visitors who request it.</li>
          <li>Touch targets sized for mobile use, and no horizontal overflow on small screens.</li>
        </ul>
      </ContentSection>

      <ContentSection heading="Known gaps">
        <p>
          Some third-party UI primitives (dialogs, tooltips) rely on inline positioning styles that are harder to
          audit exhaustively than hand-written markup. If you find a specific problem, please report it — see below.
        </p>
      </ContentSection>

      <ContentSection heading="Report an accessibility issue">
        <p>
          Use{" "}
          <Link href="/contact" className="underline">
            Contact
          </Link>{" "}
          and describe the page, what assistive technology or input method you used, and what you expected to
          happen.
        </p>
      </ContentSection>
    </ContentPage>
  );
}
