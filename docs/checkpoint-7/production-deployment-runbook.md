# Checkpoint 7: Production deployment runbook

A beginner-friendly, step-by-step launch deployment guide. For the architectural reasoning
behind the recommended hosting target (and why Cloudflare Pages specifically is not a clean fit
today), see `docs/checkpoint-6/production-deployment-runbook.md` §1 — this document does not
repeat that analysis, it operationalizes it into concrete launch steps.

## 0. Before you start

- [ ] You have a real Supabase project (see `docs/checkpoint-2/supabase-setup.md`).
- [ ] You have read `docs/checkpoint-7/database-launch-runbook.md` and
      `docs/checkpoint-7/content-readiness-report.md` — know your actual published-record count
      before launch, don't assume it's 100.
- [ ] You have decided your launch scope honestly: full launch (100+ reviewed records) or
      limited beta (fewer). See `docs/checkpoint-7/launch-blocker-checklist.md`.

## 1. Recommended deployment target

**Render.com free web service**, deployed from this repository's `Dockerfile` (see
`docs/checkpoint-6/production-deployment-runbook.md` §2 for the required `production` build
stage). Alternatives: Fly.io free allowance, or self-hosted Docker Compose on any VPS you
control — `docker-compose.yml` already defines the exact topology.

### Step by step (Render)

1. Create a free Render account, connect your GitHub repository.
2. Create a new **Web Service**, choosing "Docker" as the environment, and select the
   `production` Dockerfile stage (see §2 of the Checkpoint 6 runbook for the exact stage to add
   if it isn't there yet).
3. Set the environment variables from §3 below in Render's dashboard (never in a committed
   file).
4. Deploy. Render builds the Docker image and starts `npm run start`.
5. Add your custom domain in Render's dashboard once you have one (Render provisions a free TLS
   certificate automatically).

## 2. If you specifically want Cloudflare Pages instead

This is documented per the checkpoint's own request, with the blocker stated plainly first: as
covered in `docs/checkpoint-6/production-deployment-runbook.md` §1, this app uses a real Postgres
TCP driver (`postgres` npm package), direct `node:crypto` calls, and Server Actions that assume a
long-lived Node.js process — none of which run cleanly under Cloudflare Pages' edge-only runtime
(`@cloudflare/next-on-pages`) without first replacing the database driver with an HTTP-based one
(e.g. Neon's serverless driver, or Cloudflare Hyperdrive) and re-auditing every `node:crypto` call
against the Workers `nodejs_compat` flag. **That migration has not been done.** If you choose to
do it, here is what Cloudflare Pages itself would need:

| Setting | Value |
|---|---|
| Build command | `npx @cloudflare/next-on-pages@latest` (after the driver migration above) |
| Output directory | `.vercel/output/static` (the format `next-on-pages` produces) |
| Environment variables | Same set as §3 below, entered in Cloudflare Pages' dashboard per environment (Production/Preview) |
| Redirects | None required at the platform level — `next.config.ts`/`middleware.ts` handle all redirect logic in-app |
| Headers | Already handled in-app (`next.config.ts` `headers()`, `middleware.ts`'s CSP) — Cloudflare Pages passes these through unmodified |
| Service worker / PWA | `public/sw.js` is served as a static asset either way — no special Cloudflare Pages configuration needed once the runtime migration above is done |
| Sitemap/robots | `app/sitemap.ts`/`app/robots.ts` are dynamic routes — under `next-on-pages` these run as Edge Functions, which is supported |
| Domain setup | Cloudflare Pages → Custom domains → add your domain (if already on Cloudflare DNS, this is closer to automatic) |
| Preview vs. production | Cloudflare Pages gives every non-production branch a preview URL automatically; set preview-specific environment variables (e.g. a separate Supabase project) under Pages → Settings → Environment variables → Preview |
| Rollback | Cloudflare Pages keeps deployment history; roll back from the dashboard's Deployments list with one click |

**Until the driver migration is done, do not attempt to deploy this app to Cloudflare Pages** —
it will fail at build or runtime in ways unrelated to configuration.

## 3. Environment variables (production)

| Variable | Required? | Notes |
|---|---|---|
| `APP_ENV` | Required | `production` |
| `APP_BASE_URL` | Required | `https://yourdomain.com` — boot fails clearly without this (`instrumentation.ts`) |
| `NEXT_PUBLIC_APP_URL` | Required | Same value, `https://` — used for canonical/OG/sitemap URLs |
| `NEXT_PUBLIC_SUPABASE_URL` | Required | From your Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Required | Safe to expose to the browser (Supabase's own public-key naming) |
| `SUPABASE_SECRET_KEY` | Required | Server-only. Never `NEXT_PUBLIC_`-prefixed. Never commit it. |
| `DATABASE_URL` | Required | Pooled Supabase connection string |
| `DATABASE_MIGRATION_URL` | Recommended | Direct (non-pooled) connection string, used only by `db:migrate`/`db:reset:test` |
| `ENABLE_DATABASE_CATALOGUE`, `ENABLE_STAFF_ADMIN` | Required | `true` for a normal launch |
| `BOOTSTRAP_ADMIN_EMAIL` | Required once, at first-admin setup | See `docs/checkpoint-7/database-launch-runbook.md` §5 |
| `AI_ENABLED` | Optional | `false` is a fully safe default — the rest of the app is unaffected either way |
| `AI_PROVIDER`, `GROQ_API_KEY`, `GROQ_MODEL`, `AI_MAX_INPUT_TOKENS`, `AI_MAX_OUTPUT_TOKENS`, `AI_DAILY_GUEST_LIMIT`, `AI_DAILY_USER_LIMIT`, `AI_LOG_RETENTION_DAYS` | Optional | Only needed if `AI_ENABLED=true`; see `docs/checkpoint-6/checkpoint-6-architecture.md` |
| `NEXT_PUBLIC_ANALYTICS_ENABLED`, `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` | Optional | `false`/`none` by default — no third-party script loads otherwise |
| `NEXT_PUBLIC_ADS_ENABLED`, `NEXT_PUBLIC_AD_PROVIDER`, `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Optional | `false`/`none` by default |
| `NEXT_PUBLIC_FEEDBACK_EMAIL`, `SUPPORT_EMAIL`, `SECURITY_CONTACT_EMAIL` | Recommended | Shown on `/contact`/`/security`; without them, those pages show a generic fallback instead of an address |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Optional | No error-reporting SDK is wired in yet (see `docs/checkpoint-6/checkpoint-6-architecture.md` §6) — setting these today only logs that a DSN is configured |
| `NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS` | Optional | `false` by default |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Not used | Reserved for a future Web Push implementation — not read anywhere in the app today; do not set expecting an effect |
| `ALLOW_ADMIN_SELF_REVIEW` | Must be `false`/unset | Local-dev-only convenience; never enable in production |

Every optional variable above degrades gracefully when unset — confirmed by
`npm run launch:validate` (checks this programmatically) and by the fact that `npm run build`
was run and passed in this session with none of them set.

## 4. Launch-day sequence

1. Provision Supabase project, run database launch procedure (`database-launch-runbook.md`).
2. Deploy the app (per §1 or §2 above) with the environment variables from §3.
3. Confirm `/api/health` and `/api/ready` both report healthy.
4. Bootstrap the first administrator (`database-launch-runbook.md` §5).
5. Run the public smoke tests (`npm run launch:smoke` against the live URL, or manually per
   `docs/checkpoint-7/checkpoint-7-manual-qa.md` if that file exists, or the Checkpoint 6 manual
   QA doc's smoke-test section otherwise).
6. Point your domain's DNS at the hosting provider; confirm HTTPS works.
7. Review `docs/checkpoint-7/launch-blocker-checklist.md` one final time before announcing.

## 5. Rollback

Same as `docs/checkpoint-6/backup-and-recovery.md` §3 (migrations) and the Checkpoint 6
deployment runbook §9 (app rollback) — nothing new for Checkpoint 7 beyond: if you launched with
a limited content set and need to pull the site down entirely, the fastest safe option is
setting `ENABLE_DATABASE_CATALOGUE=false` (shows a safe "service unavailable" state) rather than
tearing down the deployment.
