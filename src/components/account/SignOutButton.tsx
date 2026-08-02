"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearCloudWorkspaceLocalState } from "@/hooks/useCloudWorkspace";

/**
 * Replaces a plain `<form action="/auth/logout">` — that form's POST caused
 * a full-page navigation with no chance for client-side code to run first,
 * which is why the cached cloud snapshot and queued outbox in this device's
 * IndexedDB (`clearCloudWorkspaceLocalState`, added for exactly this
 * purpose — see `src/hooks/useCloudWorkspace.ts`) were never actually
 * cleared on sign-out despite existing. Left uncleared, either could leak
 * this student's data to (or replay their queued mutations against)
 * whichever account signs in next on this device.
 */
export function SignOutButton({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await clearCloudWorkspaceLocalState(studentProfileId);
    await fetch("/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={signingOut}
      onClick={() => void handleSignOut()}
      className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-muted disabled:opacity-50"
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
