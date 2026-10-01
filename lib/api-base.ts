// Adresse de l'API avec bascule automatique.
//
// Pourquoi : le réseau de la maison bloque parfois le domaine api.my-mission-control.com
// (filtre routeur, incident 2026-08-14). Le même backend répond aussi sur son adresse
// Render. Si le domaine principal ne répond pas (erreur réseau), on bascule sur
// l'adresse de secours et on s'en souvient pour la session (sessionStorage).
// Une erreur HTTP (401, 403, 500…) n'entraîne PAS de bascule : le serveur a répondu.

const PRINCIPALE = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';
const SECOURS = 'https://mission-control-backend-gbtc.onrender.com';
const CLE = 'mc_api_base';

export function apiBase(): string {
  if (typeof window === 'undefined') return PRINCIPALE;
  try {
    return sessionStorage.getItem(CLE) || PRINCIPALE;
  } catch {
    return PRINCIPALE;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = apiBase();
  try {
    return await fetch(`${base}${path}`, init);
  } catch (e) {
    if (base !== PRINCIPALE) throw e; // déjà sur le secours : vraie panne
    const r = await fetch(`${SECOURS}${path}`, init); // lève si le secours est aussi injoignable
    try { sessionStorage.setItem(CLE, SECOURS); } catch { /* stockage indisponible : tant pis */ }
    return r;
  }
}
