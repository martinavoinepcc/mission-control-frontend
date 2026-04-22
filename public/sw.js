// Service worker — My Mission Control
// Objectifs : (1) recevoir des notifications Web Push et les afficher,
// (2) ouvrir/focus la bonne URL quand l'utilisateur clique sur la notif.
//
// Pas de cache agressif ici — le site reste servi normalement, le SW ne fait
// que gérer les notifications. Si on veut un mode offline plus tard, on ajoutera
// une stratégie de cache (cache-first pour statiques, network-first pour API).

const SW_VERSION = '2026-04-22-push-phase1';

self.addEventListener('install', (event) => {
  // Active immédiatement la nouvelle version dès qu'elle est installée.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Réception d'un push du service push du navigateur (FCM/APNS/Mozilla).
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
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

// Clic sur une notification : focus l'onglet existant ou ouvre-en un.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          // Si un onglet de l'app est déjà ouvert, focus-le et navigue vers la cible.
          if (url.origin === self.location.origin) {
            await client.focus();
            if ('navigate' in client) {
              try {
                await client.navigate(targetUrl);
              } catch (_err) {}
            }
            return;
          }
        } catch (_err) {}
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
