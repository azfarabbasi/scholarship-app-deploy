"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { inviteStaffMember, revokeStaffRole } from "@/lib/db/actions/team";
import { STAFF_ROLES, type StaffRole } from "@/lib/auth/permissions";

export function InviteStaffForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<StaffRole>("reviewer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await inviteStaffMember(email, displayName, role);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not invite this person.");
      return;
    }
    setEmail("");
    setDisplayName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">Invite a staff member</p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="invite-email">Email</Label>
      <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Label htmlFor="invite-name">Display name</Label>
      <Input id="invite-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <Label htmlFor="invite-role">Role</Label>
      <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
        {STAFF_ROLES.filter((r) => r !== "system_service").map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" disabled={busy}>
        Send invitation
      </Button>
    </form>
  );
}

export function RevokeRoleButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Revoke
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex items-center gap-2">
        <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-40" />
        <Button
          size="sm"
          variant="danger"
          disabled={busy || !reason.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await revokeStaffRole(assignmentId, reason.trim());
              if (!result.ok) {
                setError(result.error ?? "Could not revoke this role.");
                return;
              }
              setOpen(false);
              setReason("");
              router.refresh();
            } catch {
              setError("Could not revoke this role. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm revoke
        </Button>
      </div>
    </div>
  );
}
