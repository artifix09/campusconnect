/*
 * CampusConnect service worker (docs/07-pwa-and-mobile.md).
 *
 * - App shell and static assets: cache-first (hashed, immutable).
 * - Student pages and their data: network-first with a 3 s timeout, then cache.
 * - Admin pages, auth and every write: network-only. Many students' data
 *   must never be stored on a shared device.
 * - Logout sends CLEAR_USER_DATA, which deletes every runtime cache.
 */
const VERSION = "v1";
const SHELL = `cc-shell-${VERSION}`;
const PAGES = `cc-pages-${VERSION}`;
const DATA = `cc-data-${VERSION}`;
const ASSETS = `cc-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon.svg", "/icons/icon-192.png"])),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, PAGES, DATA, ASSETS]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_USER_DATA") {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(DATA)]));
  }
});

const isStudentPage = (url) => url.pathname === "/student" || url.pathname.startsWith("/student/");
const isCacheableData = (url) =>
  url.pathname === "/api/v1/categories" ||
  (url.pathname === "/api/v1/complaints" && !url.search.includes("cursor")) ||
  /^\/api\/v1\/complaints\/[0-9a-f-]{36}$/.test(url.pathname);

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function networkFirst(request, cacheName, preload) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([preload ?? fetch(request), timeout(3000)]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cached: admin areas, auth, attachments (signed URLs) and everything else under /api.
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/auth")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (isCacheableData(url)) {
      event.respondWith(networkFirst(request, DATA).catch(() => new Response(JSON.stringify({ title: "Offline" }), { status: 503, headers: { "Content-Type": "application/problem+json" } })));
    }
    return;
  }

  // Student pages, including React Server Component payloads for client navigation.
  if (isStudentPage(url) || url.pathname === "/notifications" || url.pathname === "/settings" || url.pathname === "/help") {
    event.respondWith(
      networkFirst(request, PAGES, request.mode === "navigate" ? event.preloadResponse : undefined).catch(async () =>
        request.mode === "navigate" ? ((await caches.match(OFFLINE_URL)) ?? Response.error()) : Response.error(),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return (await event.preloadResponse) || (await fetch(request));
        } catch {
          return (await caches.match(OFFLINE_URL)) ?? Response.error();
        }
      })(),
    );
  }
});

// Background Sync (Chromium): ask an open page to send queued complaints.
self.addEventListener("sync", (event) => {
  if (event.tag !== "complaint-outbox") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => clients.forEach((c) => c.postMessage({ type: "FLUSH_OUTBOX" }))),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "CampusConnect", body: "You have a new update.", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // keep defaults
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => w.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        return existing.navigate(target);
      }
      return self.clients.openWindow(target);
    })(),
  );
});
