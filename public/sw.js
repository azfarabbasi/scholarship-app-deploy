/**
 * Hand-authored service worker (see docs/checkpoint-1/checkpoint-1-architecture.md
 * for why: Next.js 16 defaults to Turbopack for `next build`, and Serwist's
 * InjectManifest plugin is webpack-only, so it cannot run in this project).
 *
 * Caching strategy:
 *  - App-shell routes and the offline fallback are precached on install.
 *  - Same-origin navigations: network-first, falling back to the cache and
 *    finally to /offline.
 *  - Hashed /_next/static assets: cache-first (content-addressed, safe to
 *    keep indefinitely).
 *  - Other same-origin GET requests (icons, manifest, the public catalogue
 *    API): stale-while-revalidate. The public catalogue API response itself
 *    carries a `syncedAt` timestamp so a stale cached read is never presented
 *    as freshly verified (see src/hooks/useBuiltInOpportunities.ts).
 *  - `/staff/**`, `/api/staff/**`, `/account/**`, `/api/account/**`, and
 *    `/auth/**` are never intercepted at all — no staff page, student
 *    account page, private API response, or authentication response is ever
 *    written to Cache Storage. A signed-out visit to any of these routes
 *    while offline must fail honestly, not serve a stale privileged page,
 *    and a signed-in student's private data must never be served to a
 *    different person who later uses this same browser/device.
 *  - Cross-origin requests (official scholarship websites, etc.) are never
 *    intercepted or cached — they always go straight to the network.
 *  - Checkpoint 4 adds several more session-dependent pages
 *    (`/eligibility`, `/notifications`, `/compare`, `/opportunities/*`) —
 *    they're deliberately NOT added to `APP_SHELL_URLS` below (precaching a
 *    personalised page would bake one visitor's rendered HTML into the
 *    shared cache), and every cache-write path (precache on install,
 *    navigation, and the runtime stale-while-revalidate cache) checks the
 *    same `Cache-Control: no-store`/`private` header `middleware.ts` sets
 *    for a signed-in visit to any of them before writing anything. `/api/search`
 *    is intentionally left cacheable via stale-while-revalidate — it only
 *    ever returns published, public catalogue data, the same trust level as
 *    the existing `/api/opportunities`. Eligibility answers, saved
 *    searches, reminders, and notifications are never fetched via a cached
 *    GET route at all — they're read and written exclusively through
 *    Server Actions, which this worker never intercepts (GET-only, see the
 *    `fetch` listener below).
 *  - Checkpoint 5 adds `/assistant`, `/assistant/history`,
 *    `/assistant/settings`, and `/workspace/assistant` — same treatment as
 *    the Checkpoint 4 pages above (not precached; `middleware.ts` marks them
 *    `no-store` for a signed-in visit). Every AI question/answer/feedback
 *    goes through a Server Action (POST), never a cached GET route, so no
 *    AI conversation content is ever written to Cache Storage. `/staff/ai/**`
 *    is already covered by the blanket `/staff` exclusion below.
 *
 * Guest data lives in IndexedDB/localStorage, never in Cache Storage, so
 * activating a new version and clearing old caches here never touches guest
 * records. A signed-in student's cloud workspace is cached separately, in
 * IndexedDB (`cloudCache`/`syncOutbox` — see `src/lib/sync/`), never in
 * Cache Storage either.
 */
const CACHE_VERSION = "v5";
const APP_SHELL_CACHE = `scholartrack-app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `scholartrack-runtime-${CACHE_VERSION}`;
const STATIC_ASSET_CACHE = `scholartrack-static-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([APP_SHELL_CACHE, RUNTIME_CACHE, STATIC_ASSET_CACHE]);

const APP_SHELL_URLS = [
  "/",
  "/offline",
  "/opportunities",
  "/workspace",
  "/calendar",
  "/settings",
  "/privacy",
  "/manifest.webmanifest",
];

/** Never cache a response the server marked `no-store`/`private` — same check used everywhere below. */
function isCacheable(response) {
  const cacheControl = response.headers.get("Cache-Control") || "";
  return !cacheControl.includes("no-store") && !cacheControl.includes("private");
}

/**
 * Precaches one app-shell URL, honoring `Cache-Control` — unlike a plain
 * `cache.add()`, which would write the response unconditionally. Matters
 * because the precache list includes pages (`/workspace`, `/privacy`) that
 * render session-dependent content and are marked `no-store` for a signed-in
 * visitor; if the install step runs in that visitor's browser, their
 * personalised response must never land in the shared app-shell cache.
 */
async function precacheAppShellUrl(cache, url) {
  const response = await fetch(url);
  if (response.ok && isCacheable(response)) {
    await cache.put(url, response);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      await Promise.allSettled(APP_SHELL_URLS.map((url) => precacheAppShellUrl(cache, url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !CURRENT_CACHES.has(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isNextStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    // Pages that render session-dependent content for a signed-in student
    // (e.g. /workspace, /privacy, /eligibility, /notifications, /compare,
    // /opportunities/*) mark themselves `Cache-Control: no-store` via
    // middleware.ts when a user is signed in. Never write those to the
    // shared app-shell cache — a stale copy could otherwise be served to a
    // different person who later uses this same browser/device offline.
    if (isCacheable(response)) {
      const cache = await caches.open(APP_SHELL_CACHE);
      // Awaited deliberately: an un-awaited cache.put() is a dangling microtask the browser
      // is free to abandon once this handler returns, with no guarantee it lands before a
      // subsequent "go offline" — exactly what an offline-after-visiting-online-first test needs.
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(APP_SHELL_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    const offline = await cache.match("/offline");
    if (offline) {
      return offline;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok && isCacheable(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached ?? (await networkPromise) ?? new Response("Not available offline", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Never cache external (official-source) websites.
    return;
  }

  if (
    url.pathname.startsWith("/staff") ||
    url.pathname.startsWith("/api/staff") ||
    url.pathname.startsWith("/account") ||
    url.pathname.startsWith("/api/account") ||
    url.pathname.startsWith("/auth")
  ) {
    // Staff pages/APIs, student account pages/APIs, and every Supabase auth
    // route (staff or student) are never intercepted or cached — always go
    // straight to the network.
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isNextStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
