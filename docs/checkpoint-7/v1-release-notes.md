# ScholarTrack v1.0 release notes

## What v1.0 includes

- **A database-backed, staff-reviewed scholarship/internship catalogue**, with a draft → review
  → approve → publish workflow, separation of duties, official-source requirements, and an
  append-only audit log.
- **Guest mode by design, not as a fallback** — the full catalogue, workspace, calendar, and
  planning tools work with no account, storing everything locally in the browser.
- **Optional student accounts** with cloud sync, guest-to-cloud migration (copy/merge/replace),
  offline-queued sync, and full data export/deletion.
- **Deterministic, rule-based eligibility matching** — never AI — with typo-tolerant search,
  saved searches, and a comparison view.
- **Reminders and an in-app notification center**, generated only from verified-exact or
  personal deadlines — never a guessed date.
- **An optional, source-grounded AI assistant** (off by default) that answers only from
  ScholarTrack's own stored, staff-approved data, always cited, with pre-flight safety filtering,
  rate limiting, and a staff kill switch.
- **Correction reports** so anyone can flag a suspected error, triaged by staff.
- **A Progressive Web App**: installable, works offline after a first visit, dark/light/system
  theme, and mobile-responsive throughout.
- **Production hardening**: a nonce-based Content-Security-Policy, HSTS, SEO (sitemap, robots,
  structured data), a privacy-friendly analytics abstraction (off by default), an ad-readiness
  abstraction (off by default), and health/readiness/version endpoints.
- **Twelve public trust/legal pages** (about, methodology, terms, disclaimer, contact, FAQ,
  status, security, accessibility, advertising policy, data sources, verification policy).

## What is intentionally not included

- **Native mobile apps** — a PWA only (ADR-009).
- **Web Push (background browser notifications)** — only foreground notifications while a tab is
  open; `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are reserved variable names, not
  currently read anywhere.
- **Paid SMS/WhatsApp/email notification channels** — locked out by PROJECT_RULES.md.
- **Sensitive document uploads** (passports, transcripts, financial documents) — a deliberate,
  permanent product boundary, not a temporary gap.
- **Autonomous application submission** — ScholarTrack never applies on a student's behalf.
- **A live, functioning AdSense integration** — the ad-readiness abstraction is structural only;
  no publisher account has been approved.
- **Real-time/cross-tab sync** — cloud sync is fetch-on-mount, not a live subscription.

## Known limitations

- **Content target: not met.** 55 real, sourced records exist; 0 are currently published in the
  reference database this report was generated against (publishing requires genuine human staff
  review, which has not been performed here — see
  `docs/checkpoint-7/content-readiness-report.md`). 45 additional records are needed beyond the
  55 to reach the 100-record target even after all 55 are reviewed and published.
- pgvector/embeddings for the AI assistant are structural only — full-text search is the only
  retrieval mechanism that actually runs.
- AI citations are retrieval-level, not sentence-level.
- No dedicated Open Graph social-share image (reuses the app icon).
- Two pre-existing, environment-specific Playwright tests
  (`ai-assistant.spec.ts` scenario 12, `offline.spec.ts`'s core-shell test) fail in this session's
  Docker/Playwright execution environment due to a proven, non-application service-worker-control
  timing issue — see `docs/checkpoint-6/checkpoint-6-traceability.md`'s "Honest note" section for
  the full root-cause investigation.
- The GitHub Actions CI workflow was authored and mirrors every locally-verified command but has
  not been executed on GitHub's own infrastructure.

## Privacy summary

Guest data never leaves the device. Account data is used only to provide and sync the student's
own workspace — never sold, never shared with opportunity providers. Row-level security scopes
every account-owned table to its owner. Full detail: `/privacy`.

## AI summary

Off by default. When enabled, answers only from ScholarTrack's own stored, staff-approved data,
always cited, never a final eligibility/admission/funding decision, never live web browsing,
rate-limited for guests and signed-in users alike. Full detail: `/methodology`, `/privacy`,
`docs/checkpoint-5/ai-safety-policy.md`.

## Data-source disclaimer

ScholarTrack is not the official provider of any scholarship or internship listed. Every record
links to (or names) its official source; verify current deadlines and eligibility there before
relying on anything shown here. Full detail: `/disclaimer`, `/data-sources`,
`/verification-policy`.

## Support and contact

`/contact` — general feedback and support. `/security` — vulnerability reports. Both degrade to
an honest, generic fallback message when the corresponding email isn't configured for a given
deployment — never a fake "submitted successfully."

## Next planned improvements

- Close the content gap: review and publish the 55 imported legacy records, then source 45 more.
- A dedicated Open Graph image.
- A real error-reporting SDK, if/when justified.
- Web Push, if a genuinely free-tier-compatible path is found.
- Wiring the remaining defined analytics event names to real call sites.
