# Checkpoint 7: Launch operations runbook

Day-to-day operational checklist once ScholarTrack is live. This is a manual/documented process
— no paid monitoring service is required or assumed, consistent with ADR-008's free-first budget.

## Uptime monitoring

- [ ] Register `/api/health` with a free uptime checker (e.g. UptimeRobot's free tier, or
      Cloudflare's own health checks if your DNS is on Cloudflare) — polling every 5 minutes is
      enough for a low-traffic launch.
- [ ] Alert destination: the security/support email configured in `SECURITY_CONTACT_EMAIL`/
      `SUPPORT_EMAIL`.

## Health endpoint monitoring

- `/api/health` — liveness only. A `200` with `status: "ok"` means the process is up.
- `/api/ready` — deeper check: real database query + AI configuration summary. A `503` here
  while `/api/health` still returns `200` means the app is running but the database is
  unreachable — check Supabase's own status page and connection pool limits first.
- `/api/version` — confirms which build is actually deployed; compare against your latest
  deploy when debugging a "did my change actually ship" question.
- `/staff/ops` — Administrator-only, richer diagnostic view combining all of the above plus
  AI/analytics/ads configuration status, without exposing secrets.

## Database availability checks

- [ ] Confirm Supabase project status via their dashboard whenever `/api/ready` reports
      `database: "unreachable"`.
- [ ] Watch Supabase's free-tier connection pool limit — this app uses a single pooled
      connection per server instance (`DATABASE_URL`), so a scaled-out deployment (multiple app
      instances) could exhaust the free tier's connection cap faster than expected. Free tier
      limits are documented on Supabase's own pricing page and change over time — check the
      current limit for your project's plan rather than assuming a fixed number.

## Error reporting setup

No error-reporting SDK is wired in yet (see `docs/checkpoint-6/checkpoint-6-architecture.md`
§6) — `src/lib/observability/logger.ts` logs every server-side error to stdout, which your
hosting provider's own log viewer (Render/Fly.io both provide one) is the primary place to look.
If you later wire in a real Sentry (or similar) SDK, `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` are
already reserved and read (currently only to log that a DSN is configured — see the same
section).

## Supabase quota/free-tier monitoring

- [ ] Check Supabase's dashboard monthly for: database size, bandwidth, and monthly active
      users against your plan's free-tier limits.
- [ ] Set a calendar reminder near the free tier's inactivity-pause threshold if your project
      sees low traffic (Supabase free projects can pause after a period of inactivity — check
      your project's actual current policy on Supabase's site, since free-tier terms change).

## AI usage monitoring

- If `AI_ENABLED=true`: check `/staff/ai/usage` regularly for daily question volume against
  `AI_DAILY_GUEST_LIMIT`/`AI_DAILY_USER_LIMIT`, and `/staff/ai/safety` for any blocked/flagged
  requests worth reviewing.
- If using the `groq` provider: check Groq's own console for API usage against your plan's free
  tier.
- The Administrator-only kill switch at `/staff/ai` disables the assistant instantly if a
  problem is discovered — no redeploy needed.

## Backup schedule

- [ ] Confirm Supabase's automatic daily backups are running (Dashboard → Database → Backups).
- [ ] Take a manual `pg_dump` before any schema migration or bulk import (see
      `docs/checkpoint-7/database-launch-runbook.md` §1, §11).

## Source verification schedule

- [ ] Staff periodically re-check published records against their official source and update
      `last_checked_at`/verification status — see `docs/checkpoint-2/data-verification-procedure.md`.
- No automated staleness sweep exists (a documented, deliberate scope cut — see
  `docs/checkpoint-6/backup-and-recovery.md` §12); this is a manual staff process today.

## Stale opportunity review schedule

- [ ] Recommended cadence at launch scale: monthly review of every published record's
      verification status via `/staff/discovery` and `/staff/opportunities`.

## Correction-report review schedule

- [ ] Check `/staff/corrections` at least weekly at launch scale (traffic-dependent — increase
      frequency if reports arrive faster than that).

## Staff account review

- [ ] Periodically review `/staff/team` for stale/unused staff accounts, especially after
      someone leaves the project — revoke roles promptly (`canManageStaff()`-gated action).

## Incident response process

1. Identify scope: content issue, availability issue, or security issue.
2. Contain: AI incident → `/staff/ai` kill switch. Broader issue → consider rolling back the
   deployment (`docs/checkpoint-6/production-deployment-runbook.md` §9).
3. Communicate via the channels on `/security`/`/contact`.
4. Fix, then re-run `npm run checkpoint7:validate` and `npm run launch:validate` before
   redeploying.
5. Record via the append-only `audit_log` for anything touching staff/catalogue actions.

Full detail: `docs/checkpoint-6/backup-and-recovery.md` §9.

## Support email process

`SUPPORT_EMAIL` (shown on `/contact`) is the primary channel for account/product questions.
`NEXT_PUBLIC_FEEDBACK_EMAIL` powers the in-app "Email feedback" button in Settings. Neither is
required — both pages degrade to a generic, honest fallback when unset (see
`docs/checkpoint-7/checkpoint-7-completion-report.md`'s support/feedback section).

## Security contact process

`SECURITY_CONTACT_EMAIL` (shown on `/security` and `/contact`) is the channel for vulnerability
reports. See `docs/checkpoint-6/backup-and-recovery.md` §9 for the incident checklist a report
should trigger.
