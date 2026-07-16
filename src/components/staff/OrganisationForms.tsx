"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import { createOrganisation, createProvider } from "@/lib/db/actions/reference-data";
import type { OptionRow } from "@/lib/db/reference-data";

const ORGANISATION_KINDS = [
  "government",
  "university",
  "foundation",
  "non-profit",
  "company",
  "multilateral-organisation",
  "research-institute",
  "other",
] as const;

export function CreateOrganisationForm() {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<(typeof ORGANISATION_KINDS)[number]>("university");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createOrganisation({ legalName, displayName, kind, websiteUrl: websiteUrl || undefined });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not create the organisation.");
      return;
    }
    setLegalName("");
    setDisplayName("");
    setWebsiteUrl("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="org-legal-name">Legal name</Label>
      <Input id="org-legal-name" required value={legalName} onChange={(e) => setLegalName(e.target.value)} />
      <Label htmlFor="org-display-name">Display name</Label>
      <Input id="org-display-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <Label htmlFor="org-kind">Kind</Label>
      <Select id="org-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        {ORGANISATION_KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </Select>
      <Label htmlFor="org-website">Website (optional)</Label>
      <Input id="org-website" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>
        Create organisation
      </Button>
    </form>
  );
}

export function CreateProviderForm({ organisations }: { organisations: OptionRow[] }) {
  const router = useRouter();
  const [organisationId, setOrganisationId] = useState(organisations[0]?.id ?? "");
  const [displayName, setDisplayName] = useState("");
  const [officialWebsiteUrl, setOfficialWebsiteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createProvider({ organisationId, displayName, officialWebsiteUrl: officialWebsiteUrl || undefined });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not create the provider.");
      return;
    }
    setDisplayName("");
    setOfficialWebsiteUrl("");
    router.refresh();
  }

  if (organisations.length === 0) {
    return <p className="text-sm text-foreground-muted">Create an organisation first.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-border p-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Label htmlFor="provider-org">Organisation</Label>
      <Select id="provider-org" value={organisationId} onChange={(e) => setOrganisationId(e.target.value)}>
        {organisations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
      <Label htmlFor="provider-name">Provider display name</Label>
      <Input id="provider-name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <Label htmlFor="provider-website">Official website (optional)</Label>
      <Input id="provider-website" type="url" value={officialWebsiteUrl} onChange={(e) => setOfficialWebsiteUrl(e.target.value)} />
      <Button type="submit" size="sm" disabled={busy}>
        Create provider
      </Button>
    </form>
  );
}
