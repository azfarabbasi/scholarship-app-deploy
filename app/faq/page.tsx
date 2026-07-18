import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { ContentPage } from "@/components/common/ContentPage";
import { JsonLd } from "@/components/common/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Frequently asked questions",
  description: "Common questions about cost, accounts, data verification, match labels, the AI assistant, and privacy.",
  path: "/faq",
});

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Is ScholarTrack free?",
    answer:
      "Yes. Browsing the catalogue, tracking opportunities, and using the planning tools are free and don't require an account.",
  },
  {
    question: "Do I need to create an account?",
    answer:
      "No. Guest mode is fully functional and your data stays on your device. An account is entirely optional and only exists to sync your workspace across devices.",
  },
  {
    question: "How is catalogue data verified?",
    answer:
      "Every published record goes through a staff draft-review-approve-publish workflow with a linked official source and a verification status. See the Verification policy page for exactly what each status means.",
  },
  {
    question: "Can I trust a match label as a final decision?",
    answer:
      "No. Match labels are produced by a deterministic, rule-based engine (never AI) and are always a planning aid, not a final eligibility, admission, or funding decision. Always verify eligibility on the official source.",
  },
  {
    question: "Is the AI assistant reliable?",
    answer:
      "The assistant only answers from ScholarTrack's own stored, staff-approved data, with citations, and refuses to invent deadlines or guarantee eligibility. It is a helpful explainer, not a final authority — verify anything important on the official source.",
  },
  {
    question: "How do I report incorrect information?",
    answer:
      "Use the \"Report incorrect information\" button on the opportunity's own detail page. Staff review every report before anything changes on the public listing.",
  },
  {
    question: "Is my data private?",
    answer:
      "Guest data never leaves your device. If you create an account, your workspace data is used only to provide and sync your account, is never sold, and is protected by row-level security so staff cannot browse it. See the Privacy page for the full boundary.",
  },
  {
    question: "Does ScholarTrack accept document uploads?",
    answer:
      "No. Uploading passports, transcripts, financial documents, or other sensitive files is not supported anywhere in ScholarTrack — this is a deliberate, permanent boundary, not a temporary gap.",
  },
  {
    question: "Does ScholarTrack submit applications for me?",
    answer:
      "No. ScholarTrack never submits a scholarship or internship application automatically. Every application remains something you do yourself on the official provider's website.",
  },
];

export default function FaqPage() {
  return (
    <ContentPage title="Frequently asked questions" lastReviewed="Last reviewed for Checkpoint 6.">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }}
      />
      <div className="flex flex-col gap-6">
        {FAQS.map((faq) => (
          <section key={faq.question}>
            <h2 className="text-base font-semibold text-foreground">{faq.question}</h2>
            <p className="mt-2">{faq.answer}</p>
          </section>
        ))}
      </div>
      <AdSlot placement="faq-article" className="mb-2" />
      <p>
        More detail: see{" "}
        <Link href="/methodology" className="underline">
          Methodology
        </Link>
        ,{" "}
        <Link href="/verification-policy" className="underline">
          Verification policy
        </Link>
        , and{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
        .
      </p>
    </ContentPage>
  );
}
