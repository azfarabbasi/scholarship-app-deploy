import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How ScholarTrack handles guest data, local storage, backups, and current privacy boundaries.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Privacy</h1>
      <p className="mt-2 text-sm text-foreground-muted">Last reviewed for Checkpoint 1.</p>

      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-foreground-muted">
        <Alert tone="info" title="You are using ScholarTrack as a guest">
          There are no accounts in Checkpoint 1. Everything you do — shortlisting, notes, checklists, custom
          opportunities, and preferences — is stored only in this browser.
        </Alert>

        <section>
          <h2 className="text-base font-semibold text-foreground">Where your data lives</h2>
          <p className="mt-2">
            Guest data is stored locally using your browser&rsquo;s IndexedDB (and a small amount of localStorage for
            your theme preference). It is not sent to, or synchronised with, any ScholarTrack server. We cannot see
            your notes, checklists, or custom opportunities, because they never leave your device.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Clearing your browser data</h2>
          <p className="mt-2">
            If you clear your browser&rsquo;s site data, uninstall the app, or switch devices or browsers, your guest
            data will be lost unless you have exported a backup. Back up regularly from{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Backups are your responsibility</h2>
          <p className="mt-2">
            As a guest, you are responsible for exporting and keeping your own backups. ScholarTrack does not
            currently store a copy of your data anywhere else.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">No sensitive document uploads</h2>
          <p className="mt-2">
            ScholarTrack does not currently accept uploads of passports, transcripts, certificates, financial
            documents, or any other sensitive files. This is a deliberate boundary for the current release, not a
            temporary limitation you can work around.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Verify information yourself</h2>
          <p className="mt-2">
            Scholarship and internship information in the catalogue must be verified on the official provider
            website before you rely on it. ScholarTrack shows verification status and precision alongside every
            deadline, but it does not guarantee current accuracy.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Analytics and tracking</h2>
          <p className="mt-2">
            No third-party analytics or tracking scripts run in this checkpoint. An internal analytics abstraction
            exists in the codebase but is disabled by default and collects nothing; it exists only so a future,
            privacy-reviewed analytics integration will not require scattering tracking calls through the app. It is
            never permitted to collect notes, checklist text, application details, personal deadlines, custom
            opportunity contents, or planning preferences.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">What&rsquo;s not part of Checkpoint 1</h2>
          <p className="mt-2">
            Optional accounts, cloud synchronisation, server-side storage of your workspace, advertising, and AI
            features are not implemented in this checkpoint. Guest mode will remain available even after these are
            introduced.
          </p>
        </section>
      </div>
    </Container>
  );
}
