import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Alert } from "@/components/ui/Alert";
import { getStudentSession } from "@/lib/auth/student-session";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How ScholarTrack handles guest data, optional account data, cloud sync, and current privacy boundaries.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const session = await getStudentSession();

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Privacy</h1>
      <p className="mt-2 text-sm text-foreground-muted">Last reviewed for Checkpoint 3.</p>

      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-foreground-muted">
        {session ? (
          <Alert tone="info" title={`You're signed in as ${session.email}`}>
            Your workspace data syncs to your ScholarTrack account. You can still use guest mode on other browsers or
            devices without signing in there — see below for exactly what that means.
          </Alert>
        ) : (
          <Alert tone="info" title="You are using ScholarTrack as a guest">
            An account is entirely optional. Everything you do — shortlisting, notes, checklists, custom
            opportunities, and preferences — is stored only in this browser unless you create an account and choose
            to sync it.
          </Alert>
        )}

        <section>
          <h2 className="text-base font-semibold text-foreground">Guest data is local only</h2>
          <p className="mt-2">
            Guest data is stored locally using your browser&rsquo;s IndexedDB (and a small amount of localStorage for
            your theme preference). It is not sent to, or synchronised with, any ScholarTrack server unless you
            create an account and explicitly choose to bring it in — see{" "}
            <Link href="/account/sync" className="underline">
              Sync &amp; migration
            </Link>
            . Signing in alone never uploads anything.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Account data is stored in ScholarTrack&rsquo;s database</h2>
          <p className="mt-2">
            If you create an account, your profile, shortlist, application stages, personal deadlines, notes,
            checklists, custom opportunities, and preferences are stored in ScholarTrack&rsquo;s Supabase-hosted
            database. This data is used only to provide your workspace and sync it across your devices — never for
            advertising, never sold, and never shared with opportunity providers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Your notes and checklists are private</h2>
          <p className="mt-2">
            Notes and checklist tasks are your own private workspace data. Row-level security in the database
            restricts every account-owned table to your own account; staff cannot casually browse another
            student&rsquo;s private notes, checklist, or custom opportunities. Please don&rsquo;t paste passport
            numbers, financial details, or other sensitive document contents into notes — there is nowhere in
            ScholarTrack designed to protect that kind of data, guest or signed in.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">No sensitive document uploads</h2>
          <p className="mt-2">
            ScholarTrack does not accept uploads of passports, transcripts, certificates, financial documents, or any
            other sensitive files — for guests or account holders. This is a deliberate boundary, not a temporary
            limitation you can work around.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Backups are user-controlled</h2>
          <p className="mt-2">
            Guests are responsible for exporting their own local backup from{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            . Account holders can additionally export their cloud data as JSON at any time from{" "}
            <Link href="/account/data" className="underline">
              Export &amp; import
            </Link>
            . The two exports are separate and are never combined automatically.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">You control deletion</h2>
          <p className="mt-2">
            Account holders can delete just their cloud workspace data (keeping the account) or delete their account
            entirely from{" "}
            <Link href="/account/delete" className="underline">
              Delete data
            </Link>
            . Deleting your account never deletes guest/local data on any device — that is always a separate, local
            action. Deleting your account also never deletes published catalogue data or staff audit records
            unrelated to you.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Public catalogue data is separate from your workspace</h2>
          <p className="mt-2">
            Published opportunity facts are public information, verified through ScholarTrack&rsquo;s staff review
            workflow, and stored entirely separately from any personal workspace data. Your shortlist, notes, and
            preferences are never attached to or visible from the public catalogue.
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
          <h2 className="text-base font-semibold text-foreground">Analytics, AI, and advertising</h2>
          <p className="mt-2">
            No third-party analytics or tracking scripts run in this checkpoint. An internal analytics abstraction
            exists in the codebase but is disabled by default and collects nothing. AI is not used anywhere in
            Checkpoint 3 — every planning feature here (preferences, tracking, sync) is deterministic, not
            AI-generated. There is no advertising.
          </p>
        </section>
      </div>
    </Container>
  );
}
