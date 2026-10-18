// Offline shell for Kindred Stars.
//
// Cache names include CACHE_VERSION. tools/install/inject-precache.mjs replaces
// CACHE_VERSION and PRECACHE_URLS in dist/sw.js after the Vite build. This
// source file stays valid on its own so a check can parse it before that step.
//
// A new worker installs beside the one that is running and does not call
// skipWaiting. It takes over only when the page asks, which the registration
// snippet does at launch when no level is open. Nothing here reloads a page
// or calls clients.claim(), so a level is never swapped mid-play.
//
// CACHE_VERSION stays "dev" in this file. The Vite dev server serves that
// copy at /sw.js. While the version is "dev" the worker does not precache,
// does not answer fetches, and deletes any kindred-stars cache it finds, so
// a cache-first match with ignoreSearch cannot pin /src modules or Vite's
// ?t= URLs. inject-precache.mjs replaces the version in dist/sw.js, and only
// that build intercepts requests.

const CACHE_VERSION = "70e2c63ec2";
const SHELL_CACHE = `kindred-stars-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `kindred-stars-assets-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./assets/CanvasPool-uF6WpVll.js",
  "./assets/RenderTargetSystem-DK2LvnjB.js",
  "./assets/browserAll-C6n70We-.js",
  "./assets/canvasUtils-CHsGmysk.js",
  "./assets/getTexelRangeRects-BAAg447t.js",
  "./assets/getTextureBatchBindGroup-BiqjK5Li.js",
  "./assets/index-BAiSup5M.css",
  "./assets/index-F0cGJfhO.js",
  "./assets/init-B76XrYCH.js",
  "./assets/webworkerAll-DFmgDZUl.js",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./manifest.webmanifest",
  "./splash/iphone-13-14-1170x2532.png",
  "./splash/iphone-13-mini-1125x2436.png",
  "./splash/iphone-13-pro-max-14-plus-1284x2778.png",
  "./splash/iphone-14-pro-15-16-1179x2556.png",
  "./splash/iphone-14-pro-max-16-plus-1290x2796.png",
  "./splash/iphone-16-pro-1206x2622.png",
  "./splash/iphone-16-pro-max-1320x2868.png",
  "./splash/iphone-se-750x1334.png",
  "./voice/brilliant.m4a",
  "./voice/cosmic.m4a",
  "./voice/dazzling.m4a",
  "./voice/luminous.m4a",
  "./voice/out-of-this-world.m4a",
  "./voice/over-the-moon.m4a",
  "./voice/radiant.m4a",
  "./voice/shining-bright.m4a",
  "./voice/starstruck.m4a",
  "./voice/stellar.m4a",
  "./voice/supernova.m4a",
  "./voice/written-in-the-stars.m4a"
];

self.addEventListener("install", (event) => {
  if (CACHE_VERSION === "dev") return;
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!key.startsWith("kindred-stars-")) return undefined;
          // "dev" is not a build. Drop the shell it may have filled, including
          // the caches named for this version.
          if (CACHE_VERSION === "dev" || (key !== SHELL_CACHE && key !== ASSET_CACHE)) {
            return caches.delete(key);
          }
          return undefined;
        }),
      ),
    ),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "SKIP_WAITING") return;
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (CACHE_VERSION === "dev") return;

  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  if (isDocument(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

function isDocument(request, url) {
  if (request.mode === "navigate" || request.destination === "document") return true;
  const pathname = url.pathname;
  return pathname.endsWith("/index.html") || pathname.endsWith("/");
}

async function put(cache, request, response) {
  try {
    await cache.put(request, response);
  } catch {
    // A redirected navigation can reject cache.put. The response still returns.
  }
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok && fresh.type === "basic") await put(cache, request, fresh.clone());
    return fresh;
  } catch {
    const cached =
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match("./index.html")) ||
      (await caches.match("./"));
    if (cached) return cached;
    return new Response("Kindred Stars is offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok && fresh.type === "basic") {
    const cache = await caches.open(ASSET_CACHE);
    await put(cache, request, fresh.clone());
  }
  return fresh;
}
