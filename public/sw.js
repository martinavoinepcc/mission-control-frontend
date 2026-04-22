// Service worker — My Mission Control
// Objectifs : (1) recevoir des notifications Web Push et les afficher,
// (2) ouvrir/focus la bonne URL quand l'utilisateur clique sur la notif,
//    avec fallback postMessage → window.location.href pour iOS PWA standalone
//    où client.navigate() peut échouer silencieusement.

const SW_VERSION = '2026-04-22-phase3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch (_err) {
    try {
      payload = { title: 'Mission Control', body: event.data ? event.data.text() : '' };
    } catch {
      payload = { title: 'Mission Control', body: '' };
    }
  }

  const title = payload.title || 'Mission Control';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'mc-notification',
    renotify: true,
    data: {
      url: payload.url || '/dashboard',
      receivedAt: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin !== self.location.origin) continue;

          // Focus d'abord
          try { await client.focus(); } catch (_e) {}

          // Tente client.navigate (peut échouer en standalone iOS)
          let navigated = false;
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
              navigated = true;
            } catch (_e) {
              navigated = false;
            }
          }

          // Fallback : postMessage au client, qui fait location.href = url
          // (handler dans components/push/ServiceWorkerRegistrar.tsx)
          if (!navigated) {
            try {
              client.postMessage({ type: 'mc-navigate', url: targetUrl });
            } catch (_e) {}
          }
          return;
        } catch (_err) {}
      }

      // Aucun onglet ouvert — ouvre-en un
      if (self.clients.openWindow) {
        try {
          await self.clients.openWindow(targetUrl);
        } catch (_e) {}
      }
    })()
  );
});
