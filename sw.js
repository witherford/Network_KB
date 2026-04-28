// Service worker for Network Knowledge Base.
// Strategy:
//   - App shell (HTML, CSS, JS, icons, manifest): cache-first, revalidate in background.
//   - Data JSON (data/*.json): network-first so live edits/pushes show fast,
//     fall back to the cached copy when offline.
//   - Everything else (images, etc.): stale-while-revalidate.
//
// Bump CACHE_VERSION when shipping a release that changes the app shell.
// Old caches are pruned in the activate step.

const CACHE_VERSION = 'nkb-v13-2026-04-28';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const DATA_CACHE  = `data-${CACHE_VERSION}`;

// Files we want available immediately for offline first-load.
// Hash-routed SPA — index.html is the only HTML, JS modules are
// dynamically imported on demand and cached as they're requested.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-monochrome.svg',
  './css/themes.css',
  './css/main.css',
  './css/components.css',
  './js/app.js',
  './js/version.js',
  './js/pwa.js',
  './js/components/io.js',
  './js/components/import-modal.js',
  './js/components/ai-free.js',
  './js/components/flag-validator.js',
  './js/components/visits.js',
  './js/toolkit/tz-data.js',
  './data/oui.json',
  './vendor/xlsx.mini.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll fails if any URL 404s — fall back to per-URL puts so a single
    // missing optional asset doesn't break the install.
    await Promise.all(PRECACHE_URLS.map(async url => {
      try {
        const r = await fetch(url, { cache: 'reload' });
        if (r.ok) await cache.put(url, r);
      } catch { /* offline first install — fine */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k !== SHELL_CACHE && k !== DATA_CACHE)
      .map(k => caches.delete(k)));
    // Take control of open tabs immediately.
    await self.clients.claim();
  })());
});

// Allow the page to ask the SW to skip waiting (used by the in-app
// "update available" banner).
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle same-origin GETs. Let the network deal with everything else
  // (POSTs, cross-origin API calls, GitHub raw fetches, etc.).
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests — for an SPA we always serve index.html so deep
  // links like /Network_KB/#/guides/ospf still work offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('./index.html')) || (await cache.match('./')) ||
               new Response('<h1>Offline</h1><p>You are offline and the app shell has not been cached yet.</p>', { headers: { 'Content-Type': 'text/html' }, status: 503 });
      }
    })());
    return;
  }

  // Data files — network-first so latest commits show up.
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // CSS, JS, images, manifest, icons, fonts — cache-first with background revalidate.
  event.respondWith(cacheFirst(req, SHELL_CACHE));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  // Background revalidate so tomorrow's load is fresh.
  const fetchAndUpdate = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone()).catch(()=>{});
    return res;
  }).catch(() => null);
  return cached || (await fetchAndUpdate) || new Response('', { status: 504 });
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(()=>{});
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline', message: 'Resource not in cache' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}
