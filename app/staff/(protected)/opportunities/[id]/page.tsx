import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { Button } from "@/components/ui/Button";
import { getStaffSession } from "@/lib/auth/session";
import { isAdministrator } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import {
  getCountryOptions,
  getFundingTypeOptions,
  getProviderOptions,
  getRequiredDocumentTemplateOptions,
  getStudyLevelOptions,
} from "@/lib/db/reference-data";
import { OpportunityWorkflowActions } from "@/components/staff/OpportunityWorkflowActions";
import { PromoteRelationButton } from "@/components/staff/PromoteRelationButton";
import {
  AddDocumentRequirementForm,
  AddEligibilityRuleForm,
  AddFundingBenefitForm,
  AddOfficialSourceForm,
  AddSourceEvidenceForm,
  TaxonomyPicker,
} from "@/components/staff/OpportunityRelationForms";
import {
  CreateDeadlineCycleForm,
  CreateDeadlineOccurrenceForm,
  CreateVerificationRecordForm,
} from "@/components/staff/VerificationAndDeadlineForms";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StaffOpportunityDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getStaffSession();
  if (!session) return null;

  const db = getDb();
  const [opportunity] = await db
    .select({
      id: schema.opportunities.id,
      slug: schema.opportunities.slug,
      title: schema.opportunities.title,
      summary: schema.opportunities.summary,
      status: schema.opportunities.status,
      overallVerificationStatus: schema.opportunities.overallVerificationStatus,
      applicationUrl: schema.opportunities.applicationUrl,
      officialWebsiteUrl: schema.opportunities.officialWebsiteUrl,
      providerName: schema.providers.displayName,
      opportunityTypeLabel: schema.opportunityTypes.label,
    })
    .from(schema.opportunities)
    .innerJoin(schema.providers, eq(schema.opportunities.providerId, schema.providers.id))
    .innerJoin(schema.opportunityTypes, eq(schema.opportunities.opportunityTypeId, schema.opportunityTypes.id))
    .where(eq(schema.opportunities.id, id));

  if (!opportunity) {
    notFound();
  }

  const [
    countryLinks,
    studyLevelLinks,
    officialSources,
    evidenceRows,
    documentRequirements,
    eligibilityRules,
    fundingBenefits,
    assignments,
    allCountries,
    allStudyLevels,
    allProviders,
    allFundingTypes,
    allDocumentTemplates,
  ] = await Promise.all([
    db.select({ countryId: schema.opportunityCountries.countryId }).from(schema.opportunityCountries).where(eq(schema.opportunityCountries.opportunityId, id)),
    db
      .select({ studyLevelId: schema.opportunityStudyLevels.studyLevelId })
      .from(schema.opportunityStudyLevels)
      .where(eq(schema.opportunityStudyLevels.opportunityId, id)),
    db
      .select({
        id: schema.officialSources.id,
        label: schema.officialSources.label,
        url: schema.officialSources.url,
        status: schema.officialSources.status,
      })
      .from(schema.opportunityOfficialSources)
      .innerJoin(schema.officialSources, eq(schema.opportunityOfficialSources.officialSourceId, schema.officialSources.id))
      .where(eq(schema.opportunityOfficialSources.opportunityId, id)),
    db
      .select({
        id: schema.sourceEvidence.id,
        evidenceText: schema.sourceEvidence.evidenceText,
        status: schema.sourceEvidence.status,
      })
      .from(schema.sourceEvidence)
      .where(eq(schema.sourceEvidence.opportunityId, id)),
    db
      .select({
        id: schema.opportunityDocumentRequirements.id,
        requirementLevel: schema.opportunityDocumentRequirements.requirementLevel,
        instructions: schema.opportunityDocumentRequirements.instructions,
        templateLabel: schema.requiredDocumentTemplates.label,
        status: schema.opportunityDocumentRequirements.status,
      })
      .from(schema.opportunityDocumentRequirements)
      .innerJoin(schema.requiredDocumentTemplates, eq(schema.opportunityDocumentRequirements.requiredDocumentTemplateId, schema.requiredDocumentTemplates.id))
      .where(eq(schema.opportunityDocumentRequirements.opportunityId, id)),
    db
      .select({
        id: schema.eligibilityRules.id,
        fieldKey: schema.eligibilityRules.fieldKey,
        operator: schema.eligibilityRules.operator,
        explanation: schema.eligibilityRules.explanation,
        status: schema.eligibilityRules.status,
      })
      .from(schema.eligibilityRules)
      .where(eq(schema.eligibilityRules.opportunityId, id)),
    db
      .select({
        id: schema.fundingBenefits.id,
        kind: schema.fundingBenefits.kind,
        summary: schema.fundingBenefits.summary,
        status: schema.fundingBenefits.status,
      })
      .from(schema.fundingBenefits)
      .where(eq(schema.fundingBenefits.opportunityId, id)),
    db
      .select()
      .from(schema.reviewAssignments)
      .where(eq(schema.reviewAssignments.opportunityId, id)),
    getCountryOptions(),
    getStudyLevelOptions(),
    getProviderOptions(),
    getFundingTypeOptions(),
    getRequiredDocumentTemplateOptions(),
  ]);

  const [verificationRecords, deadlineCycles] = await Promise.all([
    db
      .select()
      .from(schema.verificationRecords)
      .where(and(eq(schema.verificationRecords.subjectKind, "opportunity"), eq(schema.verificationRecords.subjectId, id))),
    db.select().from(schema.deadlineCycles).where(eq(schema.deadlineCycles.opportunityId, id)),
  ]);

  const cycleIds = deadlineCycles.map((cycle) => cycle.id);
  const deadlineOccurrences =
    cycleIds.length > 0
      ? await db.select().from(schema.deadlineOccurrences).where(inArray(schema.deadlineOccurrences.deadlineCycleId, cycleIds))
      : [];

  const evidenceOptions = evidenceRows.map((row) => ({ id: row.id, label: row.evidenceText.slice(0, 60) }));
  const cycleOptions = deadlineCycles.map((cycle) => ({
    id: cycle.id,
    label: cycle.cycleLabel ?? (cycle.cycleYear ? `Cycle ${cycle.cycleYear}` : `Cycle (${cycle.status})`),
  }));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">{opportunity!.title}</h1>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/staff/opportunities/${id}/edit`}>Edit</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/staff/opportunities/${id}/history`}>History</Link>
            </Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-foreground-muted">
          {opportunity!.providerName} · {opportunity!.opportunityTypeLabel} · status:{" "}
          <span className="font-medium text-foreground">{opportunity!.status}</span> · verification:{" "}
          <span className="font-medium text-foreground">{opportunity!.overallVerificationStatus}</span>
        </p>
        <p className="mt-2 text-sm text-foreground">{opportunity!.summary}</p>
        {opportunity!.status === "published" ? (
          <Link href={`/opportunities/${opportunity!.slug}`} className="mt-1 inline-block text-sm text-brand hover:underline">
            View public page
          </Link>
        ) : null}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Workflow</h2>
        <OpportunityWorkflowActions
          opportunityId={id}
          status={opportunity!.status}
          isAdministrator={isAdministrator(session.roles)}
          isBootstrapAdmin={session.isBootstrapAdmin}
        />
      </section>

      {assignments.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Review assignments</h2>
          <ul className="text-sm text-foreground-muted">
            {assignments.map((a) => (
              <li key={a.id}>
                {a.requiredRole} — {a.status}
                {a.dueAt ? ` (due ${a.dueAt.toLocaleDateString()})` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Countries &amp; study levels</h2>
        <TaxonomyPicker
          opportunityId={id}
          countries={allCountries}
          studyLevels={allStudyLevels}
          selectedCountryIds={countryLinks.map((c) => c.countryId)}
          selectedStudyLevelIds={studyLevelLinks.map((s) => s.studyLevelId)}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Official sources ({officialSources.length})</h2>
        <ul className="mb-2 flex flex-col gap-1 text-sm text-foreground-muted">
          {officialSources.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2">
              <span>
                {s.label} (<span className="font-medium text-foreground">{s.status}</span>) —{" "}
                <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                  {s.url}
                </a>
              </span>
              {s.status === "candidate" ? <PromoteRelationButton opportunityId={id} relationId={s.id} kind="official-source" /> : null}
            </li>
          ))}
        </ul>
        <AddOfficialSourceForm opportunityId={id} providers={allProviders} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Source evidence ({evidenceRows.length})</h2>
        <ul className="mb-2 flex flex-col gap-1 text-sm text-foreground-muted">
          {evidenceRows.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between gap-2">
              <span>
                {ev.evidenceText.slice(0, 80)} (<span className="font-medium text-foreground">{ev.status}</span>)
              </span>
              {ev.status !== "accepted" ? <PromoteRelationButton opportunityId={id} relationId={ev.id} kind="source-evidence" /> : null}
            </li>
          ))}
        </ul>
        <AddSourceEvidenceForm opportunityId={id} sources={officialSources} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Official required documents ({documentRequirements.length})</h2>
        <ul className="mb-2 flex flex-col gap-1 text-sm text-foreground-muted">
          {documentRequirements.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <span>
                {d.templateLabel} — {d.requirementLevel} ({d.status})
                {d.instructions ? ` (${d.instructions})` : ""}
              </span>
              {d.status !== "published" ? (
                <PromoteRelationButton opportunityId={id} relationId={d.id} kind="document-requirement" />
              ) : null}
            </li>
          ))}
        </ul>
        <AddDocumentRequirementForm opportunityId={id} templates={allDocumentTemplates} evidence={evidenceOptions} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Eligibility rules ({eligibilityRules.length})</h2>
        <ul className="mb-2 flex flex-col gap-1 text-sm text-foreground-muted">
          {eligibilityRules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span>
                {r.fieldKey} {r.operator} — {r.explanation} ({r.status})
              </span>
              {r.status !== "active" ? <PromoteRelationButton opportunityId={id} relationId={r.id} kind="eligibility-rule" /> : null}
            </li>
          ))}
        </ul>
        <AddEligibilityRuleForm opportunityId={id} evidence={evidenceOptions} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Funding benefits ({fundingBenefits.length})</h2>
        <ul className="mb-2 flex flex-col gap-1 text-sm text-foreground-muted">
          {fundingBenefits.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2">
              <span>
                {b.kind} — {b.summary} ({b.status})
              </span>
              {b.status !== "published" ? <PromoteRelationButton opportunityId={id} relationId={b.id} kind="funding-benefit" /> : null}
            </li>
          ))}
        </ul>
        <AddFundingBenefitForm opportunityId={id} fundingTypes={allFundingTypes} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Verification records ({verificationRecords.length})</h2>
        <p className="mb-2 text-xs text-foreground-subtle">
          Publishing requires a current (checked within 400 days), independently-confirmed &ldquo;verified&rdquo; record.
        </p>
        <ul className="mb-2 flex flex-col gap-1 text-sm text-foreground-muted">
          {verificationRecords.map((record) => (
            <li key={record.id} className="flex items-center justify-between gap-2">
              <span>
                {record.outcome} — {record.summary.slice(0, 80)} (<span className="font-medium text-foreground">{record.status}</span>,
                checked {record.checkedAt.toLocaleDateString()})
              </span>
              {record.status === "pending" ? <PromoteRelationButton opportunityId={id} relationId={record.id} kind="verification-record" /> : null}
            </li>
          ))}
        </ul>
        <CreateVerificationRecordForm opportunityId={id} sources={officialSources} evidence={evidenceOptions} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Deadline cycles ({deadlineCycles.length})</h2>
        <ul className="mb-2 flex flex-col gap-1 text-sm text-foreground-muted">
          {deadlineCycles.map((cycle) => (
            <li key={cycle.id} className="flex items-center justify-between gap-2">
              <span>
                {cycle.cycleLabel ?? `Cycle ${cycle.cycleYear ?? ""}`} — recurrence: {cycle.recurrenceCadence}{" "}
                (<span className="font-medium text-foreground">{cycle.status}</span>)
              </span>
              {cycle.status === "draft" ? <PromoteRelationButton opportunityId={id} relationId={cycle.id} kind="deadline-cycle" /> : null}
            </li>
          ))}
        </ul>
        <CreateDeadlineCycleForm opportunityId={id} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Deadline occurrences ({deadlineOccurrences.length})</h2>
        <ul className="mb-2 flex flex-col gap-1 text-sm text-foreground-muted">
          {deadlineOccurrences.map((occurrence) => (
            <li key={occurrence.id} className="flex items-center justify-between gap-2">
              <span>
                {occurrence.role} — {occurrence.precision}
                {occurrence.closingDate ? ` — closes ${occurrence.closingDate}` : ""}{" "}
                (<span className="font-medium text-foreground">{occurrence.status}</span>)
              </span>
              {occurrence.status === "draft" ? (
                <PromoteRelationButton opportunityId={id} relationId={occurrence.id} kind="deadline-occurrence" />
              ) : null}
            </li>
          ))}
        </ul>
        <CreateDeadlineOccurrenceForm opportunityId={id} cycles={cycleOptions} />
      </section>
    </div>
  );
}
