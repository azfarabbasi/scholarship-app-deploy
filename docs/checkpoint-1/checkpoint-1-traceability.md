# Checkpoint 1: Requirement traceability

Maps every Checkpoint 1 requirement area to its implementation file(s), test
coverage, validation method, and completion status. "Complete" means
implemented and verified (test passing and/or manual check performed this
checkpoint); nothing below is marked complete on the strength of code
existing alone.

## 2. Checkpoint goal (guest-first capabilities)

| Requirement | Implementation | Test | Validation | Status |
| --- | --- | --- | --- | --- |
| Browse all 55 opportunities | `src/lib/catalogue/repository.ts` | `tests/unit/dataset.test.ts` | `npm run data:validate`; `catalogue.spec.ts` | Complete |
| Search, filter, sort | `src/lib/catalogue/search.ts`, `CatalogueExplorer.tsx` | `tests/unit/catalogue-search.test.ts` (13 tests) | `catalogue.spec.ts` | Complete |
| Detailed opportunity pages | `app/opportunities/[slug]/page.tsx`, `OpportunityDetailBody.tsx` | — | `catalogue.spec.ts` (detail page test) | Complete |
| Reliable vs. uncertain deadline states | `src/lib/deadlines/engine.ts` | `deadline-scenarios.test.ts` (23 fixtures) | `npm run deadlines:audit` | Complete |
| Shortlist opportunities | `src/lib/storage/workspace.ts` (`toggleShortlisted`) | `storage.test.ts` | `workspace-tracking.spec.ts` | Complete |
| Application stages | `workspace.ts` (`setApplicationStage`), `GuestTrackingPanel.tsx` | `storage.test.ts` | `workspace-tracking.spec.ts` | Complete |
| Notes | `workspace.ts` (`setNotes`) | `storage.test.ts` | `workspace-tracking.spec.ts` | Complete |
| Checklists | `workspace.ts` (checklist CRUD) | `storage.test.ts` | `workspace-tracking.spec.ts` | Complete |
| Personal deadlines | `workspace.ts`, `src/lib/deadlines/personal.ts` | `storage.test.ts`, `deadline-personal-and-mapping.test.ts` | `workspace-tracking.spec.ts` | Complete |
| Create custom opportunities | `CustomOpportunityForm.tsx`, `src/lib/storage/custom-opportunities.ts` | `custom-opportunity-schema.test.ts`, `storage.test.ts` | `custom-opportunities.spec.ts` | Complete |
| Calendar/timeline views | `CalendarView.tsx`, `MonthGrid.tsx`, `AgendaSection.tsx` | `calendar.test.ts` | Manual QA §Calendar | Complete |
| Target-intake/graduation preferences | `PlanningPreferencesForm.tsx`, `src/lib/planning/labels.ts` | `planning-labels.test.ts` | Manual QA §Settings | Complete |
| Local-only guest data | `src/lib/storage/db.ts` (IndexedDB) | `storage.test.ts` | `docs/checkpoint-1/checkpoint-1-architecture.md` | Complete |
| Export/restore local data | `src/lib/storage/backup.ts` | `backup.test.ts` (15 tests) | `backup.spec.ts` | Complete |
| Install as PWA | `app/manifest.ts`, `public/sw.js` | — | Manual QA §PWA | Complete |
| Offline core app after first load | `public/sw.js`, `ServiceWorkerRegistration.tsx` | `offline.spec.ts` | Manual QA §Offline | Complete |
| Mobile + desktop usable | Responsive Tailwind layout throughout | `mobile-nav.spec.ts` | Manual QA §Mobile/§Desktop | Complete |
| Verification-notice messaging | `Alert` banners on home/detail/privacy pages | — | Manual QA | Complete |

## 3. Routes

| Route | File | Status |
| --- | --- | --- |
| `/` | `app/page.tsx` | Complete |
| `/opportunities` | `app/opportunities/page.tsx` | Complete |
| `/opportunities/[slug]` | `app/opportunities/[slug]/page.tsx` (`generateStaticParams`) | Complete |
| `/workspace` | `app/workspace/page.tsx` | Complete |
| `/calendar` | `app/calendar/page.tsx` | Complete |
| `/custom-opportunities/new` | `app/custom-opportunities/new/page.tsx` | Complete |
| `/custom-opportunities/[id]/edit` | `app/custom-opportunities/[id]/edit/page.tsx` | Complete |
| `/settings` | `app/settings/page.tsx` | Complete |
| `/privacy` | `app/privacy/page.tsx` | Complete |
| `/offline` | `app/offline/page.tsx` | Complete |
| Loading/empty/error/not-found states | `app/opportunities/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`, `EmptyState.tsx` | Complete |
| Page metadata/canonical paths | `metadata`/`alternates.canonical` exports per page | Complete |

Validated structurally by `npm run checkpoint1:validate` (route-existence
checks) and functionally by the Playwright suite (every route above is
visited by at least one spec).

## 4–5. Design system, shell, theme

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Header/nav/footer, responsive shell | `Header.tsx`, `Footer.tsx`, `SkipLink.tsx` | `Header.test.tsx`, `mobile-nav.spec.ts` | Complete |
| UI primitives (button/card/badge/dialog/etc.) | `src/components/ui/*` | Component tests + e2e | Complete |
| No colour-only status | `Badge.tsx` (always renders icon+text) | `OpportunityCard.test.tsx` | Complete |
| 320px–large-desktop, no horizontal overflow | Fluid Tailwind grids throughout | `mobile-nav.spec.ts` (320px check) | Complete |
| Light/dark/system theme, persisted, no flash | `ThemeProvider.tsx` (`next-themes`), `ThemeToggle.tsx` | `ThemeToggle.test.tsx`, `theme.spec.ts` | Complete |

## 6. Authoritative data layer

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Loads exactly 55 built-in opportunities | `repository.ts` (`getAllBuiltInOpportunities`) | `dataset.test.ts` | Complete |
| No duplication of the 55 records in source | JSON imported directly from `data/migrations/v0.1/scholarships.seed.json` | `dataset.test.ts` | Complete |
| By-ID / by-slug lookup | `getBuiltInOpportunityByLegacyId`, `getBuiltInOpportunityBySlug`, `getBuiltInOpportunityById` | `dataset.test.ts` | Complete |
| Unique countries/regions/study levels/precisions | `getUniqueCountries` etc., `deriveFilterOptions` | `dataset.test.ts`, `catalogue-search.test.ts` | Complete |
| Catalogue statistics | `src/lib/catalogue/stats.ts` | Exercised via `StatsGrid.tsx` on `/` | Complete |
| Safe handling of invalid/missing records | `repository.ts` (`safeParse`, skips + logs, never throws) | `getInvalidBuiltInRecordCount` asserted `0` in `dataset.test.ts` | Complete |
| Built-in vs custom distinguishable | `CatalogueOpportunity.kind` discriminant | `catalogue-search.test.ts` ("custom opportunities appear correctly") | Complete |
| No API/DB for this dataset | Build-time JSON import only; `/api/health` is the only route and adds no DB | `checkpoint1:validate` dependency-denylist check | Complete |

## 7. Deadline intelligence

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Exact/estimated/rolling/unknown/program-specific/institution-specific | `src/lib/deadlines/engine.ts` | `deadline-scenarios.test.ts` | Complete |
| Multiple deadlines, ambiguity detection | `groupAmbiguous()` in `engine.ts` | `DL-008` fixture (nearest-of-multi-scope selection) | Complete |
| Past/current/future-cycle handling, no rollover | `noDateFallbackLifecycle()`, `isPreviousIntake` handling | `DL-010`, `DL-011`, `DL-020/021` fixtures; `checkpoint1:validate` rollover check | Complete |
| User-defined personal deadlines, kept distinct | `src/lib/deadlines/personal.ts` (separate function, no verification gate) | `deadline-personal-and-mapping.test.ts` | Complete |
| Local-date comparisons, no ms/86400000 division | `src/lib/deadlines/calendar-math.ts` (ordinal-day arithmetic) | `deadline-personal-and-mapping.test.ts` (leap year, day-diff) | Complete |
| Recompute on load/focus/date-change | `src/hooks/useNow.ts` | Manual QA (date-dependent checks) | Complete |
| Student-facing labels (8 canonical) | `engine.ts` label precedence | `deadline-scenarios.test.ts` | Complete |
| Colour + text, never colour-only | `badges.tsx` (`DeadlineBadge`) | `OpportunityCard.test.tsx` | Complete |

## 8–10. Home, catalogue, cards

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Hero, current date, stats, notices | `app/page.tsx`, `CurrentDate.tsx`, `StatsGrid.tsx` | `catalogue.spec.ts`, `accessibility.spec.ts` (`/`) | Complete |
| Statistics computed from real data + date | `src/lib/catalogue/stats.ts` (`computeCatalogueStats`) | Exercised live via `StatsGrid.tsx` | Complete |
| Combinable filters, sorting, reset, active-filter count | `search.ts`, `FilterPanel.tsx`, `CatalogueToolbar.tsx` | `catalogue-search.test.ts`, `FilterPanel.test.tsx` | Complete |
| Grid/list view, persisted | `CatalogueExplorer.tsx` + `preferences.display.catalogueView` | Manual QA | Complete |
| Shareable URL query params (no private state) | `filtersFromSearchParams`/`searchParamsFromFilters` in `CatalogueExplorer.tsx` | `catalogue.spec.ts` | Complete |
| Cards: all required fields, keyboard-accessible, no misleading countdown | `OpportunityCard.tsx`, `badges.tsx` | `OpportunityCard.test.tsx` (5 tests) | Complete |

## 11–12. Detail experience and guest workspace

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Full detail fields, uncertainty warnings, safe official links | `OpportunityDetailBody.tsx` | `catalogue.spec.ts` (detail test) | Complete |
| Custom-opportunity equivalent detail experience | `CustomOpportunityDetailClient.tsx` (same route, client fallback) | `custom-opportunities.spec.ts` | Complete |
| Shortlist/stage/notes/checklist/personal deadline controls | `GuestTrackingPanel.tsx` | `storage.test.ts`, `workspace-tracking.spec.ts` | Complete |
| Generic starter checklist + reset-with-confirmation | `GENERIC_CHECKLIST_TEMPLATE`, `seedGenericChecklist`/`resetGenericChecklist` | `storage.test.ts` | Complete |
| Plain-text notes only (no HTML/script execution) | Notes rendered as React text content only, never `dangerouslySetInnerHTML` | `storage.test.ts` ("saves notes as plain text without transformation") | Complete |
| Workspace summary (stage/shortlist/progress/overdue/upcoming) | `WorkspaceSummary.tsx` | Manual QA §Workspace | Complete |

## 13. Versioned local persistence

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| IndexedDB primary store, schema version | `src/lib/storage/db.ts`, `SCHEMA_VERSION` | `storage.test.ts` (schema-init tests) | Complete |
| Safe upgrade path, no data loss on upgrade | `upgrade()` only adds missing stores | `storage.test.ts` ("persists across a simulated reload") | Complete |
| Storage-unavailable handling | `isIndexedDbAvailable()`, thrown/caught error path | `storage.test.ts` ("handles a storage failure gracefully") | Complete |
| No hydration crashes / no server access to browser APIs | All storage modules client-only; `useNow`/`useOnlineStatus` guard SSR | `npm run build` (no hydration warnings) | Complete |
| No duplicate writes | Keyed `put()` upserts (opportunityId/id/singleton keys) | `storage.test.ts` ("does not create duplicate records") | Complete |
| Storage diagnostics section | `StorageDiagnosticsSection.tsx`, `src/lib/storage/diagnostics.ts` | Manual QA §Settings | Complete |
| No sensitive document files stored | No file-store field anywhere in `storage/types.ts` | `checkpoint1:validate` sensitive-term scan | Complete |

## 14. Custom opportunities

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Zod validation | `src/lib/schemas/custom-opportunity.ts` | `custom-opportunity-schema.test.ts` (11 tests) | Complete |
| Stable IDs, collision-safe slugs | `custom-opportunities.ts` (`crypto.randomUUID`, `generateUniqueSlug` checks built-in slugs too) | `storage.test.ts` | Complete |
| Never labelled officially verified | `badges.tsx` (`VerificationBadge` custom branch) | `checkpoint1:validate` badge-text check | Complete |
| Merge into catalogue/workspace views | `customOpportunityToCatalogueOpportunity`, `useCatalogue()` | `custom-opportunities.spec.ts`, `workspace-tracking.spec.ts` | Complete |
| Edit preserves tracking state; delete requires confirmation | `EditCustomOpportunityClient.tsx` | `custom-opportunities.spec.ts` (full lifecycle test) | Complete |

## 15. Planning preferences

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Graduation date, target intake year/term, preferred levels/countries | `PlanningPreferencesForm.tsx`, `PlanningPreferences` type | Manual QA §Settings | Complete |
| Cautious informational labels only | `src/lib/planning/labels.ts` | `planning-labels.test.ts` (6 tests, incl. "never asserts formal eligibility") | Complete |
| Insufficient-information state | `timingLabel()` fallback | `planning-labels.test.ts` | Complete |

## 16. Calendar and ICS

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Month + agenda/list views | `MonthGrid.tsx`, `AgendaSection.tsx` | Manual QA §Calendar | Complete |
| Official vs personal vs custom distinction | `EventBadge.tsx`, `deriveCalendarEvents()` | `calendar.test.ts` | Complete |
| Estimated/rolling/unknown never forced onto exact dates | `deriveCalendarEvents()` (`countdown.allowed` gate) | `calendar.test.ts` ("leaves an uncertain deadline undated") | Complete |
| `.ics` export (single + all-upcoming), no private notes | `src/lib/calendar/ics.ts` | `calendar.test.ts` (5 ICS tests) | Complete |

## 17. Backup, restore, data control

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| JSON export/import, schema version, counts, timestamp | `buildBackupPayload`, `validateBackupPayload` | `backup.test.ts` | Complete |
| Merge/replace choice, preview before destructive replace | `BackupSection.tsx` | `backup.spec.ts` | Complete |
| Invalid-file / oversized-file rejection | `validateBackupPayload`, `MAX_BACKUP_FILE_SIZE_BYTES` | `backup.test.ts`, `BackupSection.test.tsx` (3 tests) | Complete |
| Prototype-pollution protection | `containsDangerousKeys()` | `backup.test.ts` (2 tests) | Complete |
| Clear-all-data with confirmation | `clearAllGuestData`, confirmation `Dialog` | `backup.test.ts` | Complete |
| CSV export of tracked applications | `buildTrackedApplicationsCsv` | `backup.test.ts` (2 tests) | Complete |

## 18. Progressive Web App

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Manifest, icons, standalone | `app/manifest.ts`, `app/icon*.tsx` | `checkpoint1:validate` | Complete |
| Service worker, app-shell caching, offline fallback | `public/sw.js` | `offline.spec.ts` | Complete |
| Never cache cross-origin (official) requests | `sw.js` origin check | `checkpoint1:validate` regex check | Complete |
| Install prompt + iOS guidance | `usePwaInstall.ts`, `PwaSection.tsx` | Manual QA §PWA | Complete |
| Update-available flow without silent reload | `ServiceWorkerRegistration.tsx` (`userRequestedRefresh` guard) | `checkpoint1:validate` regression check | Complete |

## 19. Privacy, feedback, analytics boundaries

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Privacy page | `app/privacy/page.tsx` | `accessibility.spec.ts` (`/privacy`) | Complete |
| No third-party tracking | No analytics script anywhere in `app/`/`src/` | Manual code review | Complete |
| No-op analytics abstraction | `src/lib/analytics/index.ts` | `checkpoint1:validate` module-existence check | Complete |
| Feedback (copy text / optional mailto) | `FeedbackSection.tsx`, `NEXT_PUBLIC_FEEDBACK_EMAIL` | Manual QA §Settings | Complete |

## 20. Accessibility

| Requirement | Implementation | Test | Status |
| --- | --- | --- | --- |
| Skip link, landmarks, labelled forms | `SkipLink.tsx`, semantic HTML throughout | `accessibility.spec.ts` (skip-link test) | Complete |
| `aria-live` status announcements | `LiveAnnouncer.tsx` | Used by notes-save, import/export, offline transitions | Complete |
| Keyboard-accessible dialogs, no traps | Radix `Dialog` (focus-trap built in) | `custom-opportunities.spec.ts` (delete-confirmation flow) | Complete |
| No colour-only status | `Badge.tsx` | `OpportunityCard.test.tsx` | Complete |
| Automated a11y checks on major pages | `@axe-core/playwright` | `accessibility.spec.ts` — 9 pages × 2 projects, 0 serious/critical violations | Complete |
| Reduced motion | `globals.css` `@media (prefers-reduced-motion)` | Manual QA | Complete |

## 21. Performance and reliability

| Requirement | Implementation | Validation | Status |
| --- | --- | --- | --- |
| Server components for static content | `app/**/page.tsx` server shells | `npm run build` route table (mostly ○ static) | Complete |
| No unresolved hydration warnings | Fixed `react-hooks/set-state-in-effect` findings properly (`useSyncExternalStore`, render-time state adjustment) | `npm run lint` clean; `npm run build` clean | Complete |
| Health endpoint, no DB dependency | `app/api/health/route.ts` | `checkpoint1:validate` | Complete |
| Docker build reliability preserved | `docker-compose.yml` `web` service unchanged in behaviour | `docker compose up --build` verified this checkpoint | Complete |

## 22. Automated testing

See "Test results" in `checkpoint-1-completion-report.md` for exact counts.
Required package scripts (`data:validate`, `deadlines:audit`,
`checkpoint0:validate`, `checkpoint1:validate`, `typecheck`, `test`,
`test:coverage`, `test:e2e`, `lint`, `build`) all present and passing.
Docker-compatible Playwright via `docker compose --profile test run --rm
e2e` — verified passing (55/55).

## 23. Checkpoint validator

`scripts/validate-checkpoint1.ts`, wired to `npm run checkpoint1:validate`.
75 structural checks covering routes, PWA/manifest/service-worker,
persistence/backup/custom-opportunity/calendar modules, required docs and
scripts, dependency denylist, sensitive-file-feature scan, 55-record seed
count, and no-rollover regression guard. Non-zero exit and itemised failure
messages on any missing requirement (verified by intentionally checking it
before the two Checkpoint 1 docs existed — it correctly failed with exactly
those two missing-file messages).

## 24. Documentation

This document, `checkpoint-1-architecture.md`, `checkpoint-1-manual-qa.md`,
and `checkpoint-1-completion-report.md` — all created this checkpoint.
`README.md` updated with current functionality, Docker/testing commands, PWA/
offline/backup/custom-opportunity/calendar sections, privacy boundary, and
deferred-work list.
