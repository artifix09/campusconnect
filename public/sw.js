/*
 * CampusConnect service worker (docs/07-pwa-and-mobile.md).
 *
 * Online, every page and every piece of data comes from the server, so users
 * always see the current version. Saved copies are used only when the device
 * is really offline:
 * - build assets and icons: cache-first (file names are hashed and never change);
 * - student pages: network, with the last copy kept for offline reading;
 * - React Server Component payloads, admin pages, auth and all writes: network only.
 * A new version activates immediately and removes the previous version's saved pages.
 * Logout sends CLEAR_USER_DATA, which deletes every saved page and response.
 */
const VERSION = "v2";
const SHELL = `cc-shell-${VERSION}`;
const PAGES = `cc-pages-${VERSION}`;
const DATA = `cc-data-${VERSION}`;
const ASSETS = "cc-assets"; // hashed, immutable files can outlive a version
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon.svg", "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
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
  if (event.data?.type === "CLEAR_USER_DATA") {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(DATA)]));
  }
});

const isStudentPage = (url) =>
  url.pathname === "/student" ||
  url.pathname.startsWith("/student/") ||
  ["/notifications", "/settings", "/help"].includes(url.pathname);

const isRscRequest = (request, url) => request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");

/** Network first; the saved copy is only used when the network request fails. */
async function networkThenSaved(request, cacheName, preload) {
  try {
    const response = (await preload) || (await fetch(request));
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const saved = await caches.match(request);
    if (saved) return saved;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

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

  // Never stored: RSC payloads (tied to one build), admin pages, auth and other API calls.
  if (isRscRequest(request, url) || url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/auth")) return;

  if (url.pathname === "/api/v1/categories") {
    event.respondWith(networkThenSaved(request, DATA));
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (isStudentPage(url)
        ? networkThenSaved(request, PAGES, event.preloadResponse)
        : (async () => (await event.preloadResponse) || fetch(request))()
      ).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
  }
});

// Background Sync (Chromium): ask an open page to send queued complaints.
self.addEventListener("sync", (event) => {
  if (event.tag !== "complaint-outbox") return;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window" })
      .then((clients) => clients.forEach((c) => c.postMessage({ type: "FLUSH_OUTBOX" }))),
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
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag,
        data: { url: data.url },
      }),
      // Open tabs refresh their data straight away.
      self.clients.matchAll({ type: "window" }).then((clients) => clients.forEach((c) => c.postMessage({ type: "REFRESH" }))),
    ]),
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
