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
 *  - Other same-origin GET requests (icons, manifest, catalogue data):
 *    stale-while-revalidate.
 *  - Cross-origin requests (official scholarship websites, etc.) are never
 *    intercepted or cached — they always go straight to the network.
 *
 * Guest data lives in IndexedDB/localStorage, never in Cache Storage, so
 * activating a new version and clearing old caches here never touches guest
 * records.
 */
const CACHE_VERSION = "v1";
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      await Promise.allSettled(APP_SHELL_URLS.map((url) => cache.add(url)));
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
    const cache = await caches.open(APP_SHELL_CACHE);
    cache.put(request, response.clone());
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
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
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
