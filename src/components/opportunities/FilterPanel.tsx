"use client";

import type { ReactNode } from "react";
import type { DeadlineLifecycleStatus, DeadlinePrecision } from "@/lib/domain";
import { DEADLINE_LIFECYCLE_STATUSES } from "@/lib/domain";
import type { CatalogueFilterOptions } from "@/lib/catalogue/search";
import { DEADLINE_PRECISION_OPTIONS, DEFAULT_CATALOGUE_FILTERS, type CatalogueFilters } from "@/lib/catalogue/search";
import { MATCH_LABELS, MATCH_LABEL_TEXT } from "@/lib/matching/types";
import { Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGE_OPTIONS,
} from "@/lib/storage/types";

const LIFECYCLE_LABELS: Record<DeadlineLifecycleStatus, string> = {
  "not-announced": "Not yet announced",
  "expected-to-reopen": "Expected to reopen",
  "opening-soon": "Opening soon",
  open: "Open",
  approaching: "Approaching",
  "due-today": "Due today",
  "passed-current-cycle": "Passed (this cycle)",
  rolling: "Rolling",
  "temporarily-unavailable": "Needs verification",
  "permanently-archived": "Archived",
};

const PRECISION_LABELS: Record<DeadlinePrecision, string> = {
  exact: "Exact date",
  estimated: "Estimated",
  rolling: "Rolling",
  unknown: "Unknown",
  "program-specific": "Program-specific",
  "institution-specific": "Institution-specific",
};

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="border-b border-border py-3 last:border-b-0" open>
      <summary className="cursor-pointer text-sm font-semibold text-foreground marker:text-foreground-subtle">
        {title}
      </summary>
      <div className="mt-2 flex flex-col gap-1.5 pl-1">{children}</div>
    </details>
  );
}

export interface FilterPanelProps {
  options: CatalogueFilterOptions;
  filters: CatalogueFilters;
  onChange: (next: CatalogueFilters) => void;
}

export function FilterPanel({ options, filters, onChange }: FilterPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Filters</h2>
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...DEFAULT_CATALOGUE_FILTERS, query: filters.query })}>
          Reset filters
        </Button>
      </div>

      <FilterGroup title="Match label">
        {MATCH_LABELS.map((label) => (
          <Checkbox
            key={label}
            id={`filter-match-${label}`}
            label={MATCH_LABEL_TEXT[label]}
            checked={filters.matchLabels.includes(label)}
            onChange={() => onChange({ ...filters, matchLabels: toggleValue(filters.matchLabels, label) })}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Status">
        <Checkbox
          id="filter-shortlisted"
          label="Shortlisted only"
          checked={filters.shortlistedOnly}
          onChange={(e) => onChange({ ...filters, shortlistedOnly: e.target.checked })}
        />
        <Checkbox
          id="filter-actionable"
          label="Open or currently actionable"
          checked={filters.actionableOnly}
          onChange={(e) => onChange({ ...filters, actionableOnly: e.target.checked })}
        />
        <Checkbox
          id="filter-rolling"
          label="Rolling opportunities"
          checked={filters.rollingOnly}
          onChange={(e) => onChange({ ...filters, rollingOnly: e.target.checked })}
        />
        <Checkbox
          id="filter-passed"
          label="Passed this cycle"
          checked={filters.passedOnly}
          onChange={(e) => onChange({ ...filters, passedOnly: e.target.checked })}
        />
        <Checkbox
          id="filter-verify"
          label="Verification required"
          checked={filters.verificationRequiredOnly}
          onChange={(e) => onChange({ ...filters, verificationRequiredOnly: e.target.checked })}
        />
        <Checkbox
          id="filter-has-documents"
          label="Required-document data available"
          checked={filters.requiredDocumentsOnly}
          onChange={(e) => onChange({ ...filters, requiredDocumentsOnly: e.target.checked })}
        />
        <Checkbox
          id="filter-has-eligibility"
          label="Structured eligibility data available"
          checked={filters.eligibilityRulesOnly}
          onChange={(e) => onChange({ ...filters, eligibilityRulesOnly: e.target.checked })}
        />
      </FilterGroup>

      <FilterGroup title="Origin">
        {(["built-in", "custom"] as const).map((kind) => (
          <Checkbox
            key={kind}
            id={`filter-origin-${kind}`}
            label={kind === "built-in" ? "Catalogue (built-in)" : "Custom (yours)"}
            checked={filters.origin.includes(kind)}
            onChange={() => onChange({ ...filters, origin: toggleValue(filters.origin, kind) })}
          />
        ))}
      </FilterGroup>

      <details className="border-t border-border pt-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground marker:text-foreground-subtle">
          More filters
        </summary>
        <p className="mb-2 mt-2 text-xs text-foreground-subtle">
          Study level, country, region, provider, funding, deadline state/precision, and application stage.
        </p>
        <div className="flex flex-col">
          {options.studyLevels.length > 0 ? (
            <FilterGroup title="Study level">
              {options.studyLevels.map((level) => (
                <Checkbox
                  key={level}
                  id={`filter-level-${level}`}
                  label={level}
                  checked={filters.studyLevels.includes(level)}
                  onChange={() => onChange({ ...filters, studyLevels: toggleValue(filters.studyLevels, level) })}
                />
              ))}
            </FilterGroup>
          ) : null}

          {options.countries.length > 0 ? (
            <FilterGroup title="Country">
              <div className="max-h-48 overflow-y-auto pr-1">
                {options.countries.map((country) => (
                  <Checkbox
                    key={country}
                    id={`filter-country-${country}`}
                    label={country}
                    checked={filters.countries.includes(country)}
                    onChange={() => onChange({ ...filters, countries: toggleValue(filters.countries, country) })}
                  />
                ))}
              </div>
            </FilterGroup>
          ) : null}

          {options.regions.length > 0 ? (
            <FilterGroup title="Region">
              {options.regions.map((region) => (
                <Checkbox
                  key={region}
                  id={`filter-region-${region}`}
                  label={region}
                  checked={filters.regions.includes(region)}
                  onChange={() => onChange({ ...filters, regions: toggleValue(filters.regions, region) })}
                />
              ))}
            </FilterGroup>
          ) : null}

          {options.providers.length > 0 ? (
            <FilterGroup title="Provider">
              <div className="max-h-48 overflow-y-auto pr-1">
                {options.providers.map((provider) => (
                  <Checkbox
                    key={provider}
                    id={`filter-provider-${provider}`}
                    label={provider}
                    checked={filters.providers.includes(provider)}
                    onChange={() => onChange({ ...filters, providers: toggleValue(filters.providers, provider) })}
                  />
                ))}
              </div>
            </FilterGroup>
          ) : null}

          {options.fundingCategories.length > 0 ? (
            <FilterGroup title="Funding category">
              {options.fundingCategories.map((category) => (
                <Checkbox
                  key={category}
                  id={`filter-funding-${category}`}
                  label={category}
                  checked={filters.fundingCategories.includes(category)}
                  onChange={() => onChange({ ...filters, fundingCategories: toggleValue(filters.fundingCategories, category) })}
                />
              ))}
            </FilterGroup>
          ) : null}

          <FilterGroup title="Deadline state">
            <div className="max-h-56 overflow-y-auto pr-1">
              {DEADLINE_LIFECYCLE_STATUSES.map((state) => (
                <Checkbox
                  key={state}
                  id={`filter-state-${state}`}
                  label={LIFECYCLE_LABELS[state]}
                  checked={filters.deadlineStates.includes(state)}
                  onChange={() => onChange({ ...filters, deadlineStates: toggleValue(filters.deadlineStates, state) })}
                />
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Deadline precision">
            {DEADLINE_PRECISION_OPTIONS.map((precision) => (
              <Checkbox
                key={precision}
                id={`filter-precision-${precision}`}
                label={PRECISION_LABELS[precision]}
                checked={filters.precisions.includes(precision)}
                onChange={() => onChange({ ...filters, precisions: toggleValue(filters.precisions, precision) })}
              />
            ))}
          </FilterGroup>

          <FilterGroup title="Application stage">
            {APPLICATION_STAGE_OPTIONS.map((stage) => (
              <Checkbox
                key={stage}
                id={`filter-stage-${stage}`}
                label={APPLICATION_STAGE_LABELS[stage]}
                checked={filters.stages.includes(stage)}
                onChange={() => onChange({ ...filters, stages: toggleValue(filters.stages, stage) })}
              />
            ))}
          </FilterGroup>
        </div>
      </details>
    </div>
  );
}
