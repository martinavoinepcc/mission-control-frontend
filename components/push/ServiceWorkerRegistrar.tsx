'use client';

import { useEffect } from 'react';

/**
 * Enregistre /sw.js au premier rendu côté client. Monté une seule fois dans le root layout.
 * Ne déclenche AUCUNE demande de permission — ça c'est le rôle du PushPermissionPrompt
 * sur la page Profil, sur action explicite de l'utilisateur.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (err) {
        // Silencieux : un SW qui ne s'enregistre pas en dev n'est pas bloquant.
        console.warn('[sw] register failed', err);
      }
    };

    // Register après l'hydratation initiale pour éviter de ralentir le first paint.
    const t = window.setTimeout(register, 400);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
