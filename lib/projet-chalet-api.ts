// Client API — app « Projet chalet » (2026-10-01).
//
// Les données du chantier (jalons, soumissions, contacts, budget, plans, photos)
// passent toujours par ChantierAPI (lib/chantier-api.ts). Ce fichier ajoute :
//   - ProjetChaletAPI : accueil, tuiles, pièces, dépôt, invités, partages, règlements, recherche
//   - PiecesAPI       : requis / commentaires / inspirations par pièce (/pieces)
// Rien n'est hard-codé ici : tout vient du backend (src/routes/projet-chalet.js).

import { apiBase, apiFetch } from './api-base'; // bascule auto vers l'adresse Render si le domaine est bloqué

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mc_token');
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await apiFetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as any)?.erreur || `Erreur ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

// URL d'un fichier binaire servi par l'API (les <img>/<iframe> passent le jeton en ?token=).
export function urlAvecJeton(path: string, extra = ''): string {
  const token = getToken();
  const sep = path.includes('?') ? '&' : '?';
  return `${apiBase()}${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}${extra}`;
}

// ===== Types =====

export type Section = {
  id: number;
  slug: string; // pieces | plans | jalons | budget | soumissions | contacts | photos | visite | reglements
  nom: string;
  icone: string; // nom Font Awesome sans « fa- »
  couleur: string;
  aide: string | null;
  ordre: number;
  prive: boolean;
};

export type Activite = { id: number; texte: string; icone: string; tuile: string | null; auteur: string | null; createdAt: string };

export type Accueil = {
  projet: { nom: string; adresse: string | null; avancement: number | null };
  moi: { nom: string; proprio: boolean; invite: boolean };
  sections: Section[];
  depot: { enAttente: number; aValider: number; prochainClassement: string };
  activite: Activite[];
};

export type Piece = {
  id: number;
  slug: string;
  etage: 'RDC' | 'RDJ' | 'EXT';
  numero: string | null;
  nom: string;
  qui: string | null;
  icone: string | null;
  cotes: string[];
  image: string | null; // fichier dans /mockups/pieces-img/
  ordre: number;
  compte: { requisOuverts: number; total: number };
};

export type PieceEntryKind = 'REQUIS' | 'COMMENTAIRE' | 'INSPIRATION';
export type PieceEntry = {
  id: number;
  pieceId: string;
  kind: PieceEntryKind;
  text: string;
  author: string;
  done: boolean;
  likes: string[];
  replies: Array<{ t: string; by: string; ts: string }>; // format du backend (pieces.js)
  hasPhoto: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DepotStatut = 'EN_ATTENTE' | 'A_VALIDER' | 'CLASSE';
export type Depot = {
  id: number;
  description: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  docId: number | null;
  statut: DepotStatut;
  destination: string | null;
  raison: string | null;
  confiance: number | null;
  correction: string | null;
  auteurNom: string;
  classePar: string | null;
  classeLe: string | null;
  createdAt: string;
};

export type CategoriePlan = { cle: string; nom: string; icone: string };

export type Invite = {
  id: number;
  nom: string;
  detail: string | null;
  actif: boolean;
  expireLe: string | null;
  compteCree: boolean;
  code: string | null; // visible tant que l'invité n'a pas créé son compte
  tuiles: string[];
  createdAt: string;
};

export type Reglement = {
  id: number;
  titre: string;
  source: string | null;
  lien: string | null;
  detail: string | null;
  statut: 'A_CONFIRMER' | 'CONFIRME' | 'NON_APPLICABLE';
  ordre: number;
};

export type Partage = { id: number; token: string; docId: number; titre: string; expireLe: string; vues: number; revoque: boolean; url: string; createdAt: string };

export type ResultatRecherche = { tuile: string; type: string; titre: string; sous: string; cible: string };

// ===== Endpoints =====

export const ProjetChaletAPI = {
  accueil: () => req<Accueil>('/projet-chalet/accueil'),
  sections: () => req<{ sections: Section[] }>('/projet-chalet/sections'),
  pieces: () => req<{ pieces: Piece[] }>('/projet-chalet/pieces'),
  categoriesPlans: () => req<{ categories: CategoriePlan[] }>('/projet-chalet/plans/categories'),
  activite: () => req<{ activite: Activite[] }>('/projet-chalet/activite'),
  recherche: (q: string) => req<{ resultats: ResultatRecherche[] }>(`/projet-chalet/recherche?q=${encodeURIComponent(q)}`),

  // Boîte de dépôt
  depots: () => req<{ depots: Depot[]; prochainClassement: string; heures: number[] }>('/projet-chalet/depot'),
  deposer: (body: { description: string; fileName?: string; mimeType?: string; fileData?: string }) =>
    req<{ depot: Depot; prochainClassement: string }>('/projet-chalet/depot', { method: 'POST', body: JSON.stringify(body) }),
  valider: (id: number) => req<{ depot: Depot }>(`/projet-chalet/depot/${id}/valider`, { method: 'POST' }),
  corriger: (id: number, consigne: string) =>
    req<{ depot: Depot }>(`/projet-chalet/depot/${id}/corriger`, { method: 'POST', body: JSON.stringify({ consigne }) }),
  annulerDepot: (id: number) => req<{ ok: true }>(`/projet-chalet/depot/${id}`, { method: 'DELETE' }),
  fichierDepot: (id: number) => urlAvecJeton(`/projet-chalet/depot/${id}/fichier`),

  // Invités (propriétaires seulement)
  membres: () => req<{ proprietaires: Array<{ userId: number; nom: string }>; invites: Invite[] }>('/projet-chalet/membres'),
  inviter: (body: { nom: string; detail?: string; tuiles: string[]; expireLe?: string | null }) =>
    req<{ membre: { id: number; nom: string; code: string; tuiles: string[] } }>('/projet-chalet/membres', { method: 'POST', body: JSON.stringify(body) }),
  tuilesMembre: (id: number, tuiles: string[]) =>
    req<{ tuiles: string[] }>(`/projet-chalet/membres/${id}/tuiles`, { method: 'PUT', body: JSON.stringify({ tuiles }) }),
  majMembre: (id: number, body: { nom?: string; detail?: string; actif?: boolean; expireLe?: string | null }) =>
    req<{ membre: Invite }>(`/projet-chalet/membres/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Invitation (page publique /invitation/)
  invitation: (code: string) => req<{ nom: string; detail: string | null }>(`/projet-chalet/invitation/${encodeURIComponent(code)}`),
  accepterInvitation: (code: string, username: string, password: string) =>
    req<{ ok: true; username: string }>(`/projet-chalet/invitation/${encodeURIComponent(code)}`, { method: 'POST', body: JSON.stringify({ username, password }) }),

  // Partage par lien
  partager: (docId: number, jours: number) =>
    req<{ partage: Partage }>('/projet-chalet/partages', { method: 'POST', body: JSON.stringify({ docId, jours }) }),
  partages: () => req<{ partages: Partage[] }>('/projet-chalet/partages'),
  revoquerPartage: (id: number) => req<{ ok: true }>(`/projet-chalet/partages/${id}`, { method: 'DELETE' }),

  // Ville & règlements
  reglements: () => req<{ reglements: Reglement[] }>('/projet-chalet/reglements'),
  creerReglement: (body: Partial<Reglement>) =>
    req<{ reglement: Reglement }>('/projet-chalet/reglements', { method: 'POST', body: JSON.stringify(body) }),
  majReglement: (id: number, body: Partial<Reglement>) =>
    req<{ reglement: Reglement }>(`/projet-chalet/reglements/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  supprimerReglement: (id: number) => req<{ ok: true }>(`/projet-chalet/reglements/${id}`, { method: 'DELETE' }),
};

// Notre Chalet : entrées par pièce (backend src/routes/pieces.js — renvoie un tableau brut)
export const PiecesAPI = {
  entrees: () => req<PieceEntry[]>('/pieces/entries'),
  ajouter: (body: { pieceId: string; kind: PieceEntryKind; text?: string; photoData?: string }) =>
    req<PieceEntry>('/pieces/entries', { method: 'POST', body: JSON.stringify(body) }),
  maj: (id: number, body: { done?: boolean; text?: string }) =>
    req<PieceEntry>(`/pieces/entries/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  aimer: (id: number) => req<PieceEntry>(`/pieces/entries/${id}/like`, { method: 'POST' }),
  repondre: (id: number, text: string) =>
    req<PieceEntry>(`/pieces/entries/${id}/reply`, { method: 'POST', body: JSON.stringify({ text }) }),
  supprimer: (id: number) => req<{ ok: true }>(`/pieces/entries/${id}`, { method: 'DELETE' }),
  photoUrl: (id: number) => urlAvecJeton(`/pieces/photo/${id}`),
};

// Lit un fichier en data URL (pour le dépôt : PDF, images, etc.)
export function lireFichier(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    r.readAsDataURL(file);
  });
}

// « il y a 5 min », « hier », « 3 oct. »
export function quand(iso: string): string {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'hier';
  return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}
