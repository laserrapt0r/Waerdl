// Service Worker: macht Wärdl offline-fähig und installierbar.
// Bei jeder Änderung an den Dateien VERSION erhöhen, damit Clients neu laden.
const VERSION = 'v10';
const CACHE = `waerdl-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/code.js',
  './js/schedule.js',
  './js/words.js',
  './js/words-de.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
  './icons/badge-96.png',
];
const META_CACHE = 'waerdl-meta';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('waerdl-') && k !== CACHE && k !== META_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: sofort aus dem Cache, im Hintergrund aktualisieren.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    const network = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => undefined);
    if (cached) { e.waitUntil(network); return cached; }
    return (await network) || Response.error();
  })());
});

// ---------- Erinnerung an das neue Wort des Tages ----------
// Wird vom Browser über Periodic Background Sync aufgerufen (Chrome/Edge, installierte App).
const EPOCH = Date.UTC(2026, 0, 1);
const todayNumber = (d = new Date()) =>
  Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5);
const metaUrl = () => new URL('__meta', self.registration.scope).href;

async function readMeta() {
  const cache = await caches.open(META_CACHE);
  const res = await cache.match(metaUrl());
  return res ? res.json().catch(() => ({})) : {};
}

async function writeMeta(meta) {
  const cache = await caches.open(META_CACHE);
  await cache.put(metaUrl(), new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
}

async function maybeNotify() {
  const meta = await readMeta();
  const day = todayNumber();
  if (meta.notify !== 'on') return;
  if (meta.seenDay === day || meta.notifiedDay === day) return; // heute schon gespielt bzw. erinnert
  if (new Date().getHours() < 7) return; // nachts nicht stören
  try {
    await self.registration.showNotification('Wärdl', {
      body: `Das neue Wort des Tages #${day + 1} ist da – fränggisch und hochdeutsch. Probier's glei!`,
      icon: 'icons/icon-192.png',
      badge: 'icons/badge-96.png',
      tag: 'daily-word',
      lang: 'de',
      data: { url: self.registration.scope },
    });
    await writeMeta({ ...meta, notifiedDay: day });
  } catch { /* keine Berechtigung */ }
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'daily-word') e.waitUntil(maybeNotify());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const url = e.notification.data?.url || self.registration.scope;
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (win) { await win.focus(); return; }
    await self.clients.openWindow(url);
  })());
});
