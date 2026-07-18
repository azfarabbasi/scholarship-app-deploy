# Checkpoint 6: Production deployment runbook

This runbook prepares ScholarTrack for a real deployment. It does not perform the deployment itself —
public launch is Checkpoint 7's responsibility, per the Checkpoint 6 brief.

## 1. Deployment target: why not Cloudflare Pages

The checkpoint brief asked us to target Cloudflare Pages or "the chosen Next.js-compatible target," with
instructions to document any limitation and recommend the safest alternative. We did the latter.

ScholarTrack's server-side code depends on:

- `postgres` (a real TCP Postgres driver used by Drizzle ORM), not an HTTP/serverless-driver API.
- `node:crypto` (`createHmac`, `timingSafeEqual`, `randomUUID`) used directly in rate limiting and the
  Content-Security-Policy nonce.
- Server Actions and Route Handlers that assume a long-lived Node.js process, not a stateless edge isolate
  per request.
- A hand-authored service worker and `next start` production server (see
  [Checkpoint 1 architecture](../checkpoint-1/checkpoint-1-architecture.md)).

Cloudflare Pages runs Next.js through `@cloudflare/next-on-pages`, which forces every route onto the
`edge` runtime. That would require replacing the Postgres driver with an HTTP-based client (e.g. Neon's
serverless driver, or Cloudflare Hyperdrive), re-auditing every `node:crypto` call against Workers'
`nodejs_compat` flag, and re-verifying Server Action behavior under `next-on-pages`. That is a real,
non-trivial migration, not a configuration change — we are not doing it as part of this checkpoint, and we
are not pretending it is a drop-in target.

**Recommended targets instead**, in order, all free-tier-first per ADR-008:

1. **Render.com free web service**, deployed directly from `Dockerfile` (`target: development` stage runs
   `next dev`; add a `production` stage — see §2 — for `next start`). Free tier spins down after
   inactivity (cold starts on the next request), which is an acceptable trade-off for an early-stage,
   budget-constrained deployment.
2. **Fly.io free allowance**, same Dockerfile, if Render's cold-start behavior becomes a problem.
3. **Self-hosted Docker Compose** on any small VPS you already control — `docker-compose.yml` already
   defines the exact production topology (`web` service, `db` service) used throughout development.

Cloudflare's **free-tier services ScholarTrack already uses successfully** — Cloudflare Web Analytics
(§8) — remain fully compatible regardless of hosting target, since they're just a client-side script tag.

## 2. A production Docker stage

`Dockerfile` currently only defines a `development` stage (`next dev`). Before a real deployment, add a
`production` stage:

```dockerfile
FROM node:22-alpine AS production
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --omit=dev && npm cache clean --force
COPY --chown=node:node . .
RUN npm run build
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0"]
```

This mirrors the `web-e2e` Compose service's build (`docker-compose.yml`), which already proves this
exact production build+start path works end-to-end in CI-equivalent testing.

## 3. Pre-deployment checklist

- [ ] A real Supabase project exists (see [Checkpoint 2 Supabase setup](../checkpoint-2/supabase-setup.md)).
- [ ] `npm run db:bootstrap:admin -- --confirm` has been run once against the target database, and you can
      sign in at `/staff/login`.
- [ ] All required production environment variables are set (§4) — `APP_ENV=production` will refuse to
      boot (via `instrumentation.ts` → `validateProductionEnvironment()`) if the core ones are missing.
- [ ] `npm run checkpoint0:validate` through `npm run checkpoint6:validate` all pass.
- [ ] `npm run db:check` and `npm run db:verify:migration` pass against the target database.
- [ ] `npm run build` succeeds with `NODE_ENV=production`.
- [ ] `npm run test`, `npm run db:test`, and the Playwright suite all pass.
- [ ] A database backup has been taken (§ backup-and-recovery.md) if this is a migration onto existing data.
- [ ] `AI_ENABLED` is deliberately set (`false` is a safe default; `true` requires `AI_PROVIDER`/`GROQ_API_KEY`).
- [ ] `NEXT_PUBLIC_ANALYTICS_ENABLED` and `NEXT_PUBLIC_ADS_ENABLED` are deliberately set, not left to chance.

## 4. Environment variables

See `.env.example` for the full, commented list. At minimum, production needs:

| Variable | Notes |
|---|---|
| `APP_ENV` | `production` |
| `APP_BASE_URL` | `https://` — required; `instrumentation.ts` refuses to boot otherwise. |
| `NEXT_PUBLIC_APP_URL` | Same value, `https://` — used for canonical/OG/sitemap URLs. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | From the Supabase project. |
| `DATABASE_URL`, `DATABASE_MIGRATION_URL` | Pooled vs. direct connection strings. |
| `ENABLE_DATABASE_CATALOGUE`, `ENABLE_STAFF_ADMIN` | `true` for a normal production launch. |

Everything else (AI, analytics, ads, Sentry, contact emails) is optional and degrades gracefully — see
§8 and `docs/checkpoint-6/analytics-and-ads-policy.md`.

## 5. Migrations

Never run automatically. Before starting new instances against a schema change:

```bash
npm run db:migrate
npm run db:verify:migration
```

Roll back per the migration rollback strategy in `docs/checkpoint-6/backup-and-recovery.md`.

## 6. Domain, HTTPS, redirects, headers

- Point your domain at the hosting target per its own instructions (Render/Fly.io both provision a free
  TLS certificate automatically for a custom domain).
- `APP_BASE_URL`/`NEXT_PUBLIC_APP_URL` must use `https://` in production — this is enforced at boot.
- `Strict-Transport-Security` is sent automatically once `APP_ENV=production` (see
  `src/lib/supabase/middleware.ts`) — do not enable it before HTTPS is confirmed working, or force a
  redeploy with `APP_ENV` reverted if you need to roll back to HTTP temporarily.
- No app-level redirect rules are needed; `next.config.ts`'s `headers()` and the middleware apply
  uniformly regardless of hosting target.

## 7. PWA, sitemap, robots

- The service worker (`public/sw.js`) only activates in a production build (`next start`, never
  `next dev`) — confirm `/` registers a service worker after deployment (browser DevTools → Application →
  Service Workers).
- `/sitemap.xml` and `/robots.txt` are generated per-request (`app/sitemap.ts`/`app/robots.ts`) from
  `NEXT_PUBLIC_APP_URL` — confirm they resolve to the real production domain, not `localhost`.

## 8. Post-deployment smoke tests

Manual, in order:

1. `/api/health` and `/api/ready` both return `200` with `status: "ok"`/`"ready"`.
2. `/` loads, shows the published opportunity count, and Lighthouse/browser DevTools confirm a service
   worker registers.
3. Sign in at `/staff/login` with the bootstrapped administrator account.
4. `/opportunities` shows the real catalogue; open one detail page and confirm the official-source link,
   verification badge, and (if AI is enabled) the assistant panel all render.
5. `/sitemap.xml` and `/robots.txt` resolve on the real domain.
6. View source on a couple of pages and confirm the `Content-Security-Policy`, `Strict-Transport-Security`,
   and `X-Frame-Options` response headers are present (browser DevTools → Network → Headers).
7. Submit a test correction report and confirm it appears in `/staff/corrections`.
8. If AI is enabled, ask the assistant a question about a real opportunity and confirm a cited answer.

## 9. Rollback

- **App only**: redeploy the previous known-good image/commit. Both Render and Fly.io keep prior deploy
  history for a one-click rollback; `docker compose` users should tag images by commit SHA.
- **Schema change**: see the migration rollback procedure in
  `docs/checkpoint-6/backup-and-recovery.md` — never `DROP` a column/table as part of a rollback without
  a fresh backup taken first.
- **AI incident**: use the Administrator-only kill switch at `/staff/ai` — takes effect immediately,
  no redeploy needed. See [Checkpoint 5 AI safety policy](../checkpoint-5/ai-safety-policy.md).

## 10. Known limitation carried into Checkpoint 7

This runbook documents deployment *readiness*; it does not perform a real deployment. Checkpoint 7 is
where the actual production URL, domain, and monitoring get switched on.
