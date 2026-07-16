"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { deleteMyAccount, deleteMyWorkspaceData } from "@/lib/db/actions/student/data-controls";

export function DeleteAccountSection() {
  const router = useRouter();
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handleDeleteWorkspace() {
    const result = await deleteMyWorkspaceData();
    setWorkspaceMessage(
      result.ok
        ? "Your cloud workspace data has been deleted. You can keep using your account with a fresh workspace."
        : (result.error ?? "Could not delete your workspace data."),
    );
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setAccountError(null);
    const result = await deleteMyAccount();
    if (!result.ok) {
      setDeletingAccount(false);
      setAccountError(result.error ?? "Could not delete your account.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Delete cloud workspace data</h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Deletes your tracking state, notes, checklists, custom opportunities, and preferences from ScholarTrack&rsquo;s
          database. Your account stays active with an empty workspace. Guest/local data on this or any other device
          is not affected — clear it separately from Settings if you want that too.
        </p>
        {workspaceMessage ? <Alert tone="info" className="mt-3">{workspaceMessage}</Alert> : null}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" size="sm" className="mt-3">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete cloud workspace data
            </Button>
          </DialogTrigger>
          <DialogContent
            title="Delete your cloud workspace data?"
            description="This permanently deletes your tracked opportunities, notes, checklists, custom opportunities, and preferences from ScholarTrack's database. Your account stays active."
          >
            <Alert tone="warning" className="mt-2">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> This cannot be undone. Export a backup first if
                you want to keep a copy.
              </span>
            </Alert>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="danger" size="sm" onClick={() => void handleDeleteWorkspace()}>
                  Delete workspace data
                </Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">Delete account entirely</h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Deletes your workspace data, your profile, and your sign-in itself. You would need to create a new account
          to use cloud sync again. Published opportunity data, and any staff/admin records unrelated to you, are
          never affected by this.
        </p>
        {accountError ? <Alert tone="danger" className="mt-3">{accountError}</Alert> : null}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" size="sm" className="mt-3">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete account
            </Button>
          </DialogTrigger>
          <DialogContent
            title="Delete your account?"
            description="This permanently deletes your workspace data and your sign-in. This cannot be undone."
          >
            <Alert tone="warning" className="mt-2">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> This cannot be undone. Export a backup first if
                you want to keep a copy.
              </span>
            </Alert>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button variant="danger" size="sm" disabled={deletingAccount} onClick={() => void handleDeleteAccount()}>
                {deletingAccount ? "Deleting…" : "Delete my account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
