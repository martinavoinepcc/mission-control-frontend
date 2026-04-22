'use client';

import { useEffect } from 'react';

/**
 * Enregistre /sw.js au premier rendu + écoute les postMessage du SW pour
 * naviguer côté client quand client.navigate() échoue (iOS PWA standalone).
 * Ne déclenche AUCUNE demande de permission — ça c'est le rôle du
 * PushPermissionPrompt / PushBanner sur action explicite de l'utilisateur.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (err) {
        console.warn('[sw] register failed', err);
      }
    };

    const onMessage = (ev: MessageEvent) => {
      const d = ev.data;
      if (d && d.type === 'mc-navigate' && typeof d.url === 'string') {
        // Navigation côté client — fonctionne partout, y compris PWA iOS standalone
        try {
          window.location.href = d.url;
        } catch (_e) {}
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);

    // Register après l'hydratation initiale pour éviter de ralentir le first paint.
    const t = window.setTimeout(register, 400);
    return () => {
      window.clearTimeout(t);
      try {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      } catch (_e) {}
    };
  }, []);

  return null;
}
