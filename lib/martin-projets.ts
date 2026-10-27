// Tableau de bord « Martin » — formes et présentation.
// Aucune donnée de projet ici : tout arrive de GET /api/martin/projets.

export type StatutJalon = 'fait' | 'en_cours' | 'a_faire' | 'bloque' | (string & {});

export type Jalon = {
  titre: string;
  statut: StatutJalon;
};

export type Attente = {
  point: string;
  qui: string;
};

export type Avancement = {
  faits: number | null;
  total: number | null;
  pourcentage: number | null;
  etape: string | null;
  methode: string | null;
};

export type Projet = {
  id: string;
  nom: string;
  categorie: string;
  etat: string;
  resume: string;
  avancement: Avancement;
  jalons: Jalon[];
  blocages: string[];
  en_attente: Attente[];
  prochaines_etapes: string[];
  references: string[];
};

export type DossierProjets = {
  titre: string;
  mis_a_jour: string;
  source: string;
  etats_possibles: string[];
  projets: Projet[];
};

export type TonEtat = 'cours' | 'attente' | 'livre' | 'bloque' | 'neutre';

const AVANCEMENT_VIDE: Avancement = {
  faits: null,
  total: null,
  pourcentage: null,
  etape: null,
  methode: null,
};

function estObjet(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function texte(v: unknown, max = 20000): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}

function nombreOuNul(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
}

function listeTextes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => texte(item)).filter((item): item is string => !!item);
}

function normaliserAvancement(v: unknown): Avancement {
  if (!estObjet(v)) return { ...AVANCEMENT_VIDE };
  return {
    faits: nombreOuNul(v.faits),
    total: nombreOuNul(v.total),
    pourcentage: nombreOuNul(v.pourcentage),
    etape: texte(v.etape),
    methode: texte(v.methode),
  };
}

function normaliserProjet(v: unknown): Projet | null {
  if (!estObjet(v)) return null;
  const id = texte(v.id, 200);
  const nom = texte(v.nom, 500);
  if (!id || !nom) return null;
  const jalons: Jalon[] = [];
  if (Array.isArray(v.jalons)) {
    for (const brut of v.jalons) {
      if (!estObjet(brut)) continue;
      const titre = texte(brut.titre, 500);
      const statut = texte(brut.statut, 40);
      if (titre && statut) jalons.push({ titre, statut });
    }
  }
  const enAttente: Attente[] = [];
  if (Array.isArray(v.en_attente)) {
    for (const brut of v.en_attente) {
      if (!estObjet(brut)) continue;
      const point = texte(brut.point);
      if (!point) continue;
      enAttente.push({ point, qui: texte(brut.qui, 300) || '—' });
    }
  }
  return {
    id,
    nom,
    categorie: texte(v.categorie, 200) || 'Sans catégorie',
    etat: texte(v.etat, 200) || 'État inconnu',
    resume: texte(v.resume) || '',
    avancement: normaliserAvancement(v.avancement),
    jalons,
    blocages: listeTextes(v.blocages),
    en_attente: enAttente,
    prochaines_etapes: listeTextes(v.prochaines_etapes),
    references: listeTextes(v.references),
  };
}

/** Accepte la réponse de l'API. Retourne null si le document n'est pas un dossier. */
export function validerDossier(data: unknown): DossierProjets | null {
  if (!estObjet(data) || !Array.isArray(data.projets)) return null;
  const projets: Projet[] = [];
  for (const brut of data.projets) {
    const projet = normaliserProjet(brut);
    if (projet) projets.push(projet);
  }
  // Un tableau non vide dont rien n'est lisible : réponse illisible, pas une liste vide.
  if (data.projets.length > 0 && projets.length === 0) return null;
  const etats = Array.isArray(data.etats_possibles)
    ? data.etats_possibles.map((e) => texte(e, 200)).filter((e): e is string => !!e)
    : [];
  return {
    titre: texte(data.titre, 300) || 'Martin',
    mis_a_jour: texte(data.mis_a_jour, 40) || '',
    source: texte(data.source) || '',
    etats_possibles: etats,
    projets,
  };
}

/** Pourcentage absent ou à zéro : on affiche l'étape plutôt qu'un faux 0 %. */
export function pourcentageNul(projet: Projet): boolean {
  const n = projet.avancement.pourcentage;
  return n == null || n === 0;
}

export function texteAvancement(projet: Projet): string {
  const a = projet.avancement;
  if (pourcentageNul(projet) && a.etape) return a.etape;
  const faits = a.faits ?? 0;
  const total = a.total ?? 0;
  const pct = a.pourcentage ?? 0;
  return `${faits}/${total} jalons · ${pct} %`;
}

export function largeurBarre(projet: Projet): number {
  const n = projet.avancement.pourcentage;
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function formaterMisAJour(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [annee, mois, jour] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  return new Intl.DateTimeFormat('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function tonEtat(etat: string): TonEtat {
  const s = etat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.includes('bloqu')) return 'bloque';
  if (s.includes('attente')) return 'attente';
  if (s.includes('livr') || s.includes('valid')) return 'livre';
  if (s.includes('cours')) return 'cours';
  return 'neutre';
}

const LIBELLES_STATUT: Record<string, string> = {
  fait: 'Fait',
  en_cours: 'En cours',
  a_faire: 'À faire',
  bloque: 'Bloqué',
};

export function libelleStatut(statut: string): string {
  return LIBELLES_STATUT[statut] || statut;
}

export function compterParEtat(projets: Projet[], etats: string[]): { etat: string; n: number }[] {
  const comptes = new Map<string, number>();
  for (const etat of etats) comptes.set(etat, 0);
  for (const projet of projets) {
    comptes.set(projet.etat, (comptes.get(projet.etat) || 0) + 1);
  }
  const connus = etats.filter((etat, i) => etats.indexOf(etat) === i);
  const extras = [...comptes.keys()].filter((etat) => !connus.includes(etat));
  return [...connus, ...extras].map((etat) => ({ etat, n: comptes.get(etat) || 0 }));
}

export function categoriesDe(projets: Projet[]): string[] {
  const vues = new Set<string>();
  const categories: string[] = [];
  for (const projet of projets) {
    if (vues.has(projet.categorie)) continue;
    vues.add(projet.categorie);
    categories.push(projet.categorie);
  }
  return categories;
}

export function filtrerProjets(
  projets: Projet[],
  categorie: string | null,
  etat: string | null,
): Projet[] {
  return projets.filter((projet) => {
    if (categorie && projet.categorie !== categorie) return false;
    if (etat && projet.etat !== etat) return false;
    return true;
  });
}

export function mentionPourcentage(projet?: Projet | null): string {
  if (projet && pourcentageNul(projet) && projet.avancement.methode) {
    return projet.avancement.methode;
  }
  return 'Le pourcentage = jalons faits sur jalons totaux.';
}
