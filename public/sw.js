// Service Worker der GFG-Fraktions-App: zeigt Push-Mitteilungen an
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { text: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titel || 'GFG Fraktion', {
    body: d.text || '',
    icon: d.icon || '/icon-192.png',
    badge: '/icon-192.png',
    lang: 'de',
    tag: d.tag,
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const roh = (e.notification.data && e.notification.data.url) || '/';
  const ziel = new URL(roh.startsWith('#') ? `/${roh}` : roh, self.location.origin).href;
  e.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of fenster) {
      if (c.url.startsWith(self.location.origin)) {
        await c.focus();
        c.postMessage({ typ: 'oeffne', url: roh });
        return;
      }
    }
    await self.clients.openWindow(ziel);
  })());
});
