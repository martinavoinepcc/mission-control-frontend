'use client';

// =====================================================================
// PROJET CHALET — app unifiée (Chantier Chalet + Notre Chalet), 2026-10-01
// ---------------------------------------------------------------------
// Guide pour l'équipe :
//  - Cette page est la « coquille » : elle charge l'accueil (GET /projet-chalet/accueil),
//    gère la navigation et la barre d'onglets, puis affiche l'écran demandé.
//  - Un écran = un fichier dans ./_ecrans/. Il est déclaré UNE fois dans ECRANS
//    ci-dessous avec la tuile qui le protège (un invité sans la tuile est renvoyé
//    à l'accueil ; le backend refuse aussi, de son côté).
//  - L'écran courant vit dans l'adresse : #plans, #serie/12, #lecteur/12/34...
//    → le bouton retour du téléphone marche et on peut partager un lien d'écran.
//  - Le style vient de ./_kit/theme.ts (classes .pc-*), les briques de ./_kit/ui.tsx.
//  - Les tuiles, leur ordre et qui les voit viennent de la BD : rien n'est codé ici.
// =====================================================================

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { ProjetChaletAPI, type Accueil as AccueilData } from '@/lib/projet-chalet-api';
import { THEME_CSS } from './_kit/theme';
import { Ctx, Icone, Chargement, Erreur, type ChaletCtx, type Nav, type EcranProps } from './_kit/ui';

import Accueil from './_ecrans/Accueil';
import Depot from './_ecrans/Depot';
import Chercher from './_ecrans/Chercher';
import Activite from './_ecrans/Activite';
import Moi from './_ecrans/Moi';
import Reglements from './_ecrans/Reglements';
import Visite from './_ecrans/Visite';
import { PlansCategories, PlanCategorie, Serie, Lecteur } from './_ecrans/Plans';
import { Jalons, JalonFiche } from './_ecrans/Jalons';
import Soumissions from './_ecrans/Soumissions';
import Contacts from './_ecrans/Contacts';
import Budget from './_ecrans/Budget';
import Photos from './_ecrans/Photos';
import { Pieces, PieceFiche } from './_ecrans/Pieces';

// Registre des écrans : nom dans l'adresse → composant + tuile requise (null = toujours visible).
const ECRANS: Record<string, { C: ComponentType<EcranProps>; tuile: string | null }> = {
  accueil: { C: Accueil, tuile: null },
  depot: { C: Depot, tuile: null },
  chercher: { C: Chercher, tuile: null },
  activite: { C: Activite, tuile: null },
  moi: { C: Moi, tuile: null },
  pieces: { C: Pieces, tuile: 'pieces' },
  piece: { C: PieceFiche, tuile: 'pieces' },
  plans: { C: PlansCategories, tuile: 'plans' },
  planCat: { C: PlanCategorie, tuile: 'plans' },
  serie: { C: Serie, tuile: 'plans' },
  lecteur: { C: Lecteur, tuile: 'plans' },
  jalons: { C: Jalons, tuile: 'jalons' },
  jalon: { C: JalonFiche, tuile: 'jalons' },
  budget: { C: Budget, tuile: 'budget' },
  soumissions: { C: Soumissions, tuile: 'soumissions' },
  contacts: { C: Contacts, tuile: 'contacts' },
  photos: { C: Photos, tuile: 'photos' },
  visite: { C: Visite, tuile: 'visite' },
  reglements: { C: Reglements, tuile: 'reglements' },
};

// Onglets du bas. La boîte de dépôt est un onglet ordinaire (utile, pas prioritaire — demande Martin).
const ONGLETS: Array<{ ecran: string; icone: string; libelle: string }> = [
  { ecran: 'accueil', icone: 'house', libelle: 'Accueil' },
  { ecran: 'chercher', icone: 'magnifying-glass', libelle: 'Chercher' },
  { ecran: 'depot', icone: 'inbox', libelle: 'Dépôt' },
  { ecran: 'activite', icone: 'clock-rotate-left', libelle: 'Activité' },
  { ecran: 'moi', icone: 'user', libelle: 'Moi' },
];

function lireNav(): Nav {
  if (typeof window === 'undefined') return { ecran: 'accueil', params: [] };
  const [ecran, ...params] = decodeURIComponent(window.location.hash.replace(/^#/, '')).split('/').filter(Boolean);
  return { ecran: ecran && ECRANS[ecran] ? ecran : 'accueil', params };
}

export default function ProjetChaletPage() {
  const router = useRouter();
  const [nav, setNav] = useState<Nav>({ ecran: 'accueil', params: [] });
  const [accueil, setAccueil] = useState<AccueilData | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    try {
      setAccueil(await ProjetChaletAPI.accueil());
      setErreur(null);
    } catch (e: any) {
      if (e?.status === 401) { router.push('/'); return; }
      if (e?.status === 403) { setErreur("Tu n'as pas accès au Projet chalet."); return; }
      setErreur(e?.message || 'Erreur de chargement.');
    }
  }, [router]);

  useEffect(() => {
    if (!localStorage.getItem('mc_token')) { router.push('/'); return; }
    setNav(lireNav());
    const surHash = () => { setNav(lireNav()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', surHash);
    recharger();
    return () => window.removeEventListener('hashchange', surHash);
  }, [recharger, router]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.setTimeout(() => setToastMsg((x) => (x === m ? null : x)), 2800);
  }, []);

  const ctx: ChaletCtx = useMemo(() => {
    const visibles = new Set((accueil?.sections || []).map((s) => s.slug));
    return {
      accueil,
      recharger,
      toast,
      proprio: !!accueil?.moi.proprio,
      peutVoir: (slug: string) => visibles.has(slug),
      aller: (ecran: string, ...params: Array<string | number>) => {
        window.location.hash = [ecran, ...params.map((p) => encodeURIComponent(String(p)))].join('/');
      },
      retour: () => {
        if (window.history.length > 1) window.history.back();
        else window.location.hash = 'accueil';
      },
    };
  }, [accueil, recharger, toast]);

  // Garde-fou : un écran dont la tuile n'est pas partagée avec moi renvoie à l'accueil.
  const def = ECRANS[nav.ecran] || ECRANS.accueil;
  const permis = !def.tuile || !accueil || ctx.peutVoir(def.tuile);
  const Ecran = permis ? def.C : ECRANS.accueil.C;
  const ongletActif = ONGLETS.some((o) => o.ecran === nav.ecran) ? nav.ecran : 'accueil';
  const attente = (accueil?.depot.enAttente || 0) + (accueil?.moi.proprio ? accueil?.depot.aValider || 0 : 0);

  return (
    <div className="pc">
      <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" />
      <Ctx.Provider value={ctx}>
        <main className="pc-vue">
          {erreur ? (
            <div style={{ paddingTop: 40 }}>
              <Erreur message={erreur} />
              <div style={{ marginTop: 12 }}><a className="pc-btn second" href="/dashboard/">Retour au portail</a></div>
            </div>
          ) : !accueil ? (
            <Chargement />
          ) : (
            <Ecran key={nav.ecran + '/' + nav.params.join('/')} params={permis ? nav.params : []} />
          )}
        </main>
        <nav className="pc-tabbar" aria-label="Navigation Projet chalet">
          <div className="pc-tabbar-in">
            {ONGLETS.map((o) => (
              <button key={o.ecran} className={`pc-tab ${ongletActif === o.ecran ? 'on' : ''}`} onClick={() => ctx.aller(o.ecran)} aria-current={ongletActif === o.ecran ? 'page' : undefined}>
                <span className="pc-bulle"><Icone nom={o.icone} />{o.ecran === 'depot' && attente > 0 && <b>{attente}</b>}</span>
                <span>{o.libelle}</span>
              </button>
            ))}
          </div>
        </nav>
        {toastMsg && <div className="pc-toast" role="status"><Icone nom="circle-check" /> {toastMsg}</div>}
      </Ctx.Provider>
    </div>
  );
}
