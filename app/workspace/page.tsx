import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";
import { CloudWorkspaceView } from "@/components/workspace/CloudWorkspaceView";
import { AccountStatusBanner } from "@/components/workspace/AccountStatusBanner";
import { getStudentSession } from "@/lib/auth/student-session";

export const metadata: Metadata = {
  title: "Your workspace",
  description: "Track shortlisted opportunities, application stages, notes, checklists, and personal deadlines.",
  alternates: { canonical: "/workspace" },
};

/**
 * Guest and signed-in users share this page but never share code paths:
 * guests keep using `WorkspaceView` (IndexedDB-only, untouched since
 * Checkpoint 1); a signed-in student gets `CloudWorkspaceView` instead,
 * backed entirely by their own cloud rows. See
 * `docs/checkpoint-3/checkpoint-3-architecture.md` for why the two are kept
 * deliberately separate rather than merged into one data-source-agnostic
 * component.
 */
export default async function WorkspacePage() {
  const session = await getStudentSession();

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Your workspace</h1>

      <div className="mt-4">
        <AccountStatusBanner signedIn={Boolean(session)} email={session?.email} />
      </div>

      {session ? (
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          Back it up any time from{" "}
          <a href="/account/data" className="underline">
            Export &amp; import
          </a>
          .
        </p>
      ) : (
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          Back it up from{" "}
          <a href="/settings" className="underline">
            Settings
          </a>{" "}
          so you don&rsquo;t lose it.
        </p>
      )}

      <div className="mt-6">{session ? <CloudWorkspaceView studentProfileId={session.studentProfileId} /> : <WorkspaceView />}</div>
    </Container>
  );
}
