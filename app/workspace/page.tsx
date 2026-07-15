import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";

export const metadata: Metadata = {
  title: "Your workspace",
  description: "Track shortlisted opportunities, application stages, notes, checklists, and personal deadlines.",
  alternates: { canonical: "/workspace" },
};

export default function WorkspacePage() {
  return (
    <Container className="py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Your workspace</h1>
      <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
        Everything here is stored locally in your browser as a guest. Back it up from{" "}
        <a href="/settings" className="underline">
          Settings
        </a>{" "}
        so you don&rsquo;t lose it.
      </p>
      <div className="mt-6">
        <WorkspaceView />
      </div>
    </Container>
  );
}
