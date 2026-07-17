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
      <p className="mt-2 text-sm text-foreground-muted">Last reviewed for Checkpoint 5.</p>

      <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed text-foreground-muted">
        {session ? (
          <Alert tone="info" title={`You're signed in as ${session.email}`}>
            Your workspace data syncs to your ScholarTrack account. You can still use guest mode on other browsers or
            devices without signing in there — see below for exactly what that means.
          </Alert>
        ) : (
          <Alert tone="info" title="You are using ScholarTrack as a guest">
            An account is entirely optional. Everything you do — shortlisting, notes, checklists, custom
            opportunities, eligibility answers, saved searches, reminders, and preferences — is stored only in this
            browser unless you create an account and choose to sync it.
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
            checklists, custom opportunities, preferences, eligibility answers, saved searches, reminders, and
            notifications are stored in ScholarTrack&rsquo;s Supabase-hosted database. This data is used only to
            provide your workspace and sync it across your devices — never for advertising, never sold, and never
            shared with opportunity providers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Eligibility answers are optional, and matching is never AI</h2>
          <p className="mt-2">
            The{" "}
            <Link href="/eligibility" className="underline">
              eligibility questionnaire
            </Link>{" "}
            is entirely optional and every field can be left blank. It deliberately never asks for passport or ID
            numbers, your address, financial or medical information, religious or ethnic identity, or the contents
            of a transcript, CV, or recommendation letter. Match labels (like &ldquo;Strong potential fit&rdquo; or
            &ldquo;Needs verification&rdquo;) are produced entirely by a fixed, human-authored rule engine that
            compares your answers against an opportunity&rsquo;s structured eligibility rules and deadline data — no
            AI or machine-learning model is used anywhere in this comparison. A match label is a planning aid only:
            it is never a final eligibility, admission, or funding decision, and it is always shown next to a plain
            explanation of the specific rules it used (or, honestly, that it didn&rsquo;t have enough data to judge).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Reminders and browser notifications</h2>
          <p className="mt-2">
            Reminders are generated deterministically from official exact-and-verified deadlines and from your own
            personal deadlines — ScholarTrack never invents or estimates a date for you. There is no paid SMS,
            WhatsApp, or email notification service anywhere in the product. If you explicitly enable browser
            notifications (only ever after you click a button asking for permission — never automatically), the
            notification is delivered by your own browser and is visible on the device you granted permission on; it
            is not a message sent through any ScholarTrack-operated push service. Notifications and reminders are
            never shared across devices except via the same account sync as the rest of your workspace.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Your notes, eligibility answers, and discovery data are private</h2>
          <p className="mt-2">
            Notes, checklist tasks, eligibility answers, saved searches, and reminders are your own private workspace
            data. Row-level security in the database restricts every account-owned table to your own account —
            staff cannot casually browse another student&rsquo;s private notes, checklist, custom opportunities,
            eligibility answers, saved searches, or reminders. The one staff-facing page that touches this data at
            all (the discovery-quality support tooling) only ever shows aggregate counts across all students, never
            an individual student&rsquo;s saved search text, reminder title, or note contents. Please don&rsquo;t
            paste passport numbers, financial details, or other sensitive document contents into notes — there is
            nowhere in ScholarTrack designed to protect that kind of data, guest or signed in.
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
          <h2 className="text-base font-semibold text-foreground">The AI assistant</h2>
          <p className="mt-2">
            When enabled, the{" "}
            <Link href="/assistant" className="underline">
              assistant
            </Link>{" "}
            answers only from ScholarTrack&rsquo;s own stored, staff-approved source data and published catalogue
            records — it does not browse the live web, and it cannot see draft, unpublished, or staff-internal
            content. Every factual answer includes citations back to the specific record or excerpt it came from. The
            assistant is never a final eligibility, admission, or funding authority: deterministic matching (see
            above) still produces match labels, and the assistant may only explain that result in plain language, not
            override or replace it. It also never invents a deadline, requirement, or fact that isn&rsquo;t in a
            stored source — when the source doesn&rsquo;t confirm something, it says so honestly instead of guessing.
          </p>
          <p className="mt-2">
            Your message is sent to a configured AI provider (Groq, when set up) to generate a response; if no
            provider is configured, or you&rsquo;re offline, the assistant clearly shows an unavailable state and the
            rest of ScholarTrack keeps working normally. Please don&rsquo;t paste passport numbers, financial
            details, transcripts, or other sensitive document contents into a message — the same boundary as the rest
            of the product.
          </p>
          <p className="mt-2">
            As a guest, assistant conversations are stored only on this device (never uploaded) unless you choose
            &ldquo;temporary chat,&rdquo; in which case nothing is stored at all, even locally. If you sign in, your
            history is <em>only</em> saved to your account if you explicitly enable it in{" "}
            <Link href="/assistant/settings" className="underline">
              Assistant settings
            </Link>
            ; you can clear local or cloud history at any time from there, and cloud history is included in your{" "}
            <Link href="/account/data" className="underline">
              account export
            </Link>{" "}
            only when enabled, and is deleted along with the rest of your workspace if you{" "}
            <Link href="/account/delete" className="underline">
              delete your account
            </Link>
            . Row-level security restricts your conversations to your own account — staff cannot browse another
            student&rsquo;s assistant conversations. Optional feedback you leave on an answer (helpful, incorrect,
            missing citation, etc.) is used only to improve source quality and is reviewed by staff.
          </p>
          <p className="mt-2">
            Requests are rate-limited (a small daily question limit for guests and signed-in users alike) to prevent
            abuse, and attempts to make the assistant reveal internal instructions, secrets, or another person&rsquo;s
            private data are automatically refused before any message reaches the AI provider.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Analytics and advertising</h2>
          <p className="mt-2">
            No third-party analytics or tracking scripts run in this checkpoint. An internal analytics abstraction
            exists in the codebase but is disabled by default and collects nothing. Every planning and matching
            feature outside the assistant (preferences, tracking, sync, search ranking, eligibility matching,
            reminders) remains deterministic and human-authored, not AI-generated. There is no advertising.
          </p>
        </section>
      </div>
    </Container>
  );
}
