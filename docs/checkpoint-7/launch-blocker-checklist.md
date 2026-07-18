# Checkpoint 7: Launch blocker checklist

**Overall verdict: NOT READY for a full public launch today. READY FOR LIMITED BETA once the one
real blocker below (content review) is completed by an actual human.** No critical engineering
blocker remains — every remaining item is either a manual/editorial step or an external action
this environment cannot perform (real deployment, a real domain).

## Blockers

| # | Item | Severity | Status | Owner/action | Launch can proceed? |
|---|---|---|---|---|---|
| 1 | **Content: 0 published records** | 🔴 Blocker | Not resolved | A staff Reviewer/Senior Reviewer/Administrator must review and publish records via `/staff/opportunities` — see `docs/checkpoint-7/database-launch-runbook.md` §7. This is a human/editorial task, not an engineering one. | **No**, not for a full public launch. Yes, for an internal/private staging preview. |
| 2 | **100-record content target** | 🟡 Known gap, documented | Not met (55 real records exist; 45 more needed even after all 55 are published) | Content sourcing is ongoing work — see `docs/checkpoint-2/content-expansion-gap.md`. | Yes, if launching explicitly as "limited beta" / early catalogue, clearly labelled as such. |
| 3 | **External deployment** | ⚪ Manual/external | Not performed — no real hosting credentials or domain available in this environment | Follow `docs/checkpoint-7/production-deployment-runbook.md` step by step. | N/A — a real deployment step, not a code readiness gap. |
| 4 | **Domain** | ⚪ Manual/external | Not configured — no real domain provided | Point DNS at the chosen host once deployed. | N/A |
| 5 | **First-admin bootstrap on the real production database** | ⚪ Manual, required before any staff can review content | Not performed against a real production Supabase project (this session verified the procedure against a local database only) | `docs/checkpoint-7/database-launch-runbook.md` §5 | Must be done before blocker #1 can be resolved |
| 6 | **AI configuration** | 🟢 Not a blocker | Off by default (`AI_ENABLED=false`); fully functional in mock-provider mode for testing | Optional — enable with a real `GROQ_API_KEY` only if/when desired; the rest of the app is unaffected either way | Yes — launch works identically with AI on or off |
| 7 | **Analytics/ads configuration** | 🟢 Not a blocker | Both off by default, verified programmatically | Optional — enable later per `docs/checkpoint-6/analytics-and-ads-policy.md` | Yes |
| 8 | **Monitoring** | 🟡 Recommended, not blocking | Not yet set up (external service — see `docs/checkpoint-7/launch-operations-runbook.md`) | Register `/api/health` with a free uptime checker before or shortly after go-live | Recommended before launch, not strictly required |
| 9 | **Two pre-existing e2e test failures** | 🟡 Known, investigated, not blocking | `ai-assistant.spec.ts` #12 and `offline.spec.ts`'s core-shell test fail in this session's Docker/Playwright environment — proven pre-existing (reproduces against unmodified Checkpoint 5 code), not a regression | No action required for launch; a real fix needs a different test harness or Playwright/Chromium version | Yes — the underlying feature (offline caching, SW registration) works; only this specific test-environment timing check is affected |
| 10 | **CI workflow never executed on GitHub** | 🟡 Known, not blocking | `.github/workflows/ci.yml` exists, mirrors every locally-verified command, but has not run on GitHub's infrastructure from this environment | Push to GitHub and confirm a real run once repository hosting is set up | Not a launch blocker — local validation already covers the same commands |

## Items needing manual verification (cannot be verified from this environment)

- [ ] A real Supabase project has been created and its free-tier limits reviewed.
- [ ] `BOOTSTRAP_ADMIN_EMAIL` points to a real, controlled email address.
- [ ] The chosen hosting provider's environment variables match
      `docs/checkpoint-7/production-deployment-runbook.md` §3 exactly.
- [ ] HTTPS actually works on the real domain before enabling HSTS-dependent behaviour.
- [ ] At least one real staff member has completed the review workflow for at least one
      opportunity, end to end, on the real production database.

## Summary by area

| Area | Status |
|---|---|
| Content readiness | ❌ Not met — see `content-readiness-report.md` |
| Deployment readiness | ⚠️ Documented, not executed (no real credentials available here) |
| Database readiness | ✅ Procedure verified against a real local database this session |
| Security readiness | ✅ 11/11 `launch:security` checks passed |
| SEO readiness | ✅ 61/61 `launch:seo` checks passed |
| Accessibility readiness | ✅ See `checkpoint-7-completion-report.md` for the exact e2e pass count |
| Performance readiness | ✅ Within budget (2.08 MB / 4 MB) |
| AI readiness | ✅ Safe by default, fully tested in mock mode |
| Analytics/ads readiness | ✅ Both off by default |
| Monitoring readiness | ⚠️ Documented, not yet actually configured against a live deployment |

## Do not launch if

- Fewer than one record is published and the launch is presented as anything other than an
  explicitly-labelled early/beta catalogue.
- `APP_ENV` is not set to `production` on the real deployment (boot-time validation won't run).
- Any of the manual verification items above are unchecked.
