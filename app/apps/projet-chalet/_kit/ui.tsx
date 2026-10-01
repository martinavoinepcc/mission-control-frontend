'use client';

// Composants communs de Projet chalet. Chaque écran se construit avec ces
// briques (classes .pc-* définies dans theme.ts) : pas de style en dur dans
// les écrans, pour garder le même look partout et un mode sombre qui marche.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Accueil } from '@/lib/projet-chalet-api';

// ---------- Icônes ----------
// Les icônes des tuiles et des pièces viennent de la BD (ex. « compass-drafting »),
// donc on résout le nom Font Awesome à l'exécution. Inconnu → cercle.
const ICONES: Record<string, IconDefinition> = {};
for (const def of Object.values(fas) as IconDefinition[]) {
  if (def && def.iconName) ICONES[def.iconName] = def;
}
export function Icone({ nom, className }: { nom: string; className?: string }) {
  const def = ICONES[nom] || ICONES['circle'];
  return <FontAwesomeIcon icon={def} className={className} fixedWidth />;
}

// ---------- Navigation + contexte de l'app ----------
// L'écran courant vit dans l'adresse (#plans, #serie/12...) : le bouton « retour »
// du téléphone fonctionne et on peut partager un lien vers un écran précis.
export type Nav = { ecran: string; params: string[] };

// Props reçues par chaque écran : les paramètres de l'adresse (#serie/12 → ['12']).
export type EcranProps = { params: string[] };

export type ChaletCtx = {
  accueil: Accueil | null;
  recharger: () => Promise<void>;
  aller: (ecran: string, ...params: Array<string | number>) => void;
  retour: () => void;
  toast: (msg: string) => void;
  peutVoir: (slug: string) => boolean; // la tuile est-elle visible pour moi ?
  proprio: boolean;
};

export const Ctx = createContext<ChaletCtx | null>(null);
export function useChalet(): ChaletCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useChalet hors de Projet chalet');
  return c;
}

// ---------- Briques ----------

export function Entete({ titre, retour, actions }: { titre: string; retour?: () => void; actions?: ReactNode }) {
  const { retour: retourDefaut } = useChalet();
  return (
    <div className="pc-entete">
      <button className="pc-retour" onClick={retour || retourDefaut} aria-label="Retour">
        <Icone nom="chevron-left" />
      </button>
      <h2>{titre}</h2>
      {actions}
    </div>
  );
}

export function EnteteSimple({ titre, actions }: { titre: string; actions?: ReactNode }) {
  return (
    <div className="pc-entete">
      <h2>{titre}</h2>
      {actions}
    </div>
  );
}

type Variante = 'ok' | 'warn' | 'bad' | 'info' | 'neutre';
export function Chip({ v = 'neutre', children }: { v?: Variante; children: ReactNode }) {
  return <span className={`pc-chip pc-c-${v}`}>{children}</span>;
}

export function Vide({ children }: { children: ReactNode }) {
  return <div className="pc-vide">{children}</div>;
}

export function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="pc-erreur" role="alert">{message}</div>;
}

export function Chargement() {
  return <div className="pc-chargement"><Icone nom="circle-notch" className="fa-spin" /></div>;
}

// Feuille qui monte du bas (remplace les modales). Fermer = toucher le voile ou Échap.
export function Feuille({ titre, onFermer, children }: { titre?: string; onFermer: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // On garde la DERNIÈRE fonction de fermeture dans une ref : les écrans peuvent passer
  // une fonction fléchée inline sans que la feuille reprenne le focus à chaque frappe.
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer.current(); };
    window.addEventListener('keydown', k);
    ref.current?.focus(); // une seule fois, à l'ouverture
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="pc-voile" onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className="pc-feuille" role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} ref={ref}>
        <div className="pc-poignee" />
        {titre && <h3>{titre}</h3>}
        {children}
      </div>
    </div>
  );
}

// Confirmation avant une action irréversible (supprimer...). Pas de confirm() du navigateur.
export function Confirmer({ message, libelle = 'Supprimer', onOui, onNon }: { message: string; libelle?: string; onOui: () => void | Promise<void>; onNon: () => void }) {
  const [occupe, setOccupe] = useState(false);
  return (
    <Feuille titre="Confirmer" onFermer={onNon}>
      <p style={{ marginTop: 0 }}>{message}</p>
      <div className="pc-rangee">
        <button className="pc-btn danger" style={{ flex: 1 }} disabled={occupe} onClick={async () => { setOccupe(true); try { await onOui(); } finally { setOccupe(false); } }}>
          {libelle}
        </button>
        <button className="pc-btn second" style={{ flex: 1 }} onClick={onNon}>Annuler</button>
      </div>
    </Feuille>
  );
}

// Champ de formulaire étiqueté.
export function Champ({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="pc-champ">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

// Format date courte « 3 oct. 2026 » (UTC pour les dates sans heure, comme l'app chantier).
export function dateCourte(d: string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  return x.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function argent(n: number | null | undefined): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n || 0);
}
