// Service worker — My Mission Control
// Objectifs : (1) recevoir des notifications Web Push et les afficher,
// (2) ouvrir/focus la bonne URL quand l'utilisateur clique sur la notif,
//    avec fallback postMessage → window.location.href pour iOS PWA standalone
//    où client.navigate() peut échouer silencieusement,
// (3) V2.10 : mettre à jour le badge OS (chiffre rouge sur l'icone PWA) à
//    partir du `badge` count fourni dans le payload push (count global de
//    messages non-lus pour cet user, calcule cote backend a chaque envoi).

const SW_VERSION = '2026-05-28-v2-badge';

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
    // badge (showNotification) = icone monochrome de la notif Android (PAS le
    // chiffre rouge — ca c'est l'App Badge ci-dessous). On laisse l'icone PWA
    // par defaut, OS-controlled.
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'mc-notification',
    renotify: true,
    data: {
      url: payload.url || '/dashboard',
      receivedAt: Date.now(),
    },
  };
  if (payload.image) options.image = payload.image;

  // V2.10 : badge OS (App Badge API) — chiffre rouge sur l'icone PWA, mis a
  // jour cote SW depuis le push (le client peut etre ferme). Le backend envoie
  // `badge: <unreadCount>` calcule globalement pour cet user. setAppBadge(0)
  // efface le chiffre, setAppBadge(n>0) l'affiche.
  const tasks = [];
  if (typeof payload.badge === 'number' && self.navigator && typeof self.navigator.setAppBadge === 'function') {
    if (payload.badge > 0) {
      tasks.push(self.navigator.setAppBadge(payload.badge).catch(() => {}));
    } else if (typeof self.navigator.clearAppBadge === 'function') {
      tasks.push(self.navigator.clearAppBadge().catch(() => {}));
    }
  }
  tasks.push(self.registration.showNotification(title, options));
  event.waitUntil(Promise.all(tasks));
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

          try { await client.focus(); } catch (_e) {}

          let navigated = false;
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
              navigated = true;
            } catch (_e) {
              navigated = false;
            }
          }

          if (!navigated) {
            try {
              client.postMessage({ type: 'mc-navigate', url: targetUrl });
            } catch (_e) {}
          }
          return;
        } catch (_err) {}
      }

      if (self.clients.openWindow) {
        try {
          await self.clients.openWindow(targetUrl);
        } catch (_e) {}
      }
    })()
  );
});
