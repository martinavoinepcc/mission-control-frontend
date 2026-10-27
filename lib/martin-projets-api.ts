// GET /api/martin/projets — authentifié, Martin seul (le backend refuse les autres).
// Le jeton est celui de la session déjà ouverte (mc_token). Aucun dossier n'est embarqué ici.

import { clearToken } from './api';
import { apiFetch } from './api-base';
import { validerDossier, type DossierProjets } from './martin-projets';

const CHEMIN = '/api/martin/projets';

export class ErreurProjets extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ErreurProjets';
    this.status = status;
  }
}

function jetonSession(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mc_token');
}

export async function chargerDossierMartin(): Promise<DossierProjets> {
  const jeton = jetonSession();
  if (!jeton) {
    throw new ErreurProjets('Session expirée. Reconnecte-toi.', 401);
  }

  let res: Response;
  try {
    res = await apiFetch(CHEMIN, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jeton}`,
      },
    });
  } catch {
    throw new ErreurProjets('Impossible de joindre le serveur. Réessaie dans un moment.');
  }

  const data = await res.json().catch(() => null);

  if (res.status === 401) {
    clearToken();
    throw new ErreurProjets('Session expirée. Reconnecte-toi.', 401);
  }
  if (res.status === 403) {
    throw new ErreurProjets('Cet espace est réservé à Martin.', 403);
  }
  if (res.status === 404) {
    throw new ErreurProjets('Les projets ne sont pas encore disponibles. Réessaie plus tard.', 404);
  }
  if (!res.ok) {
    const message = data && typeof data === 'object' && typeof (data as { erreur?: unknown }).erreur === 'string'
      ? (data as { erreur: string }).erreur
      : 'Impossible de charger les projets.';
    throw new ErreurProjets(message, res.status);
  }

  const dossier = validerDossier(data);
  if (!dossier) {
    throw new ErreurProjets('La réponse du serveur n\'a pas le format attendu.');
  }
  return dossier;
}
