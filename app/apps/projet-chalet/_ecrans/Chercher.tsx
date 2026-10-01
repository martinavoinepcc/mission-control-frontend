'use client';

// CHERCHER — une seule boîte de recherche pour tout le projet.
// Route : GET /projet-chalet/recherche?q= (le backend ne renvoie que ce que la
// personne a le droit de voir, tuile par tuile).

import { useEffect, useRef, useState } from 'react';
import { ProjetChaletAPI, type ResultatRecherche } from '@/lib/projet-chalet-api';
import { useChalet, Icone, Vide, Erreur, EnteteSimple, type EcranProps } from '../_kit/ui';

// Où mène chaque type de résultat (écran + paramètre).
function destination(r: ResultatRecherche): [string, string?] {
  switch (r.type) {
    case 'piece':
    case 'entree': return ['piece', r.cible];
    case 'serie': return ['serie', r.cible];
    case 'jalon': return ['jalon', r.cible];
    case 'contact': return ['contacts'];
    case 'soumission': return ['soumissions'];
    case 'reglement': return ['reglements'];
    default: return [r.tuile];
  }
}

const ICONE: Record<string, string> = {
  piece: 'door-open', entree: 'list-check', serie: 'compass-drafting', jalon: 'flag-checkered',
  contact: 'address-book', soumission: 'file-signature', reglement: 'scale-balanced',
};

export default function Chercher(_: EcranProps) {
  const { aller } = useChalet();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ResultatRecherche[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => { champ.current?.focus(); }, []);

  // Recherche 300 ms après la dernière frappe.
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setRes(null); return; }
    const id = window.setTimeout(async () => {
      try {
        setRes((await ProjetChaletAPI.recherche(t)).resultats);
        setErreur(null);
      } catch (e: any) {
        setErreur(e?.message || 'Recherche impossible.');
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [q]);

  return (
    <>
      <EnteteSimple titre="Chercher" />
      <div className="pc-champ">
        <label htmlFor="recherche" className="pc-surtitre">Pièce, plan, contact, jalon, soumission…</label>
        <input id="recherche" ref={champ} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" placeholder="Ex. : cuisine, TALO, génératrice" />
      </div>
      <Erreur message={erreur} />
      {res === null ? (
        <Vide>Tape au moins 2 lettres.</Vide>
      ) : res.length === 0 ? (
        <Vide>Aucun résultat pour « {q} ».</Vide>
      ) : (
        <div className="pc-liste">
          {res.map((r, i) => {
            const [ecran, param] = destination(r);
            return (
              <button key={i} className="pc-ligne" onClick={() => (param ? aller(ecran, param) : aller(ecran))}>
                <span className="pc-pt pc-c-info"><Icone nom={ICONE[r.type] || 'circle'} /></span>
                <span className="pc-txt"><b>{r.titre}</b><small>{r.sous}</small></span>
                <Icone nom="chevron-right" />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
