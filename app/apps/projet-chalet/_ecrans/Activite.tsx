'use client';

// ACTIVITÉ — journal du projet : dépôts, classements de Claude (8 h / 12 h / 18 h / 22 h),
// confirmations, invitations… Route : GET /projet-chalet/activite
// (un invité ne voit que ce qui touche ses tuiles).

import { useEffect, useState } from 'react';
import { ProjetChaletAPI, quand, type Activite as ActiviteT } from '@/lib/projet-chalet-api';
import { Icone, Vide, Erreur, Chargement, EnteteSimple, type EcranProps } from '../_kit/ui';

export default function Activite(_: EcranProps) {
  const [rows, setRows] = useState<ActiviteT[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    ProjetChaletAPI.activite().then((r) => setRows(r.activite)).catch((e) => setErreur(e?.message || 'Erreur de chargement.'));
  }, []);

  return (
    <>
      <EnteteSimple titre="Activité" />
      <Erreur message={erreur} />
      {!rows && !erreur ? <Chargement /> : rows && rows.length === 0 ? <Vide>Rien pour l'instant.</Vide> : rows && (
        <div className="pc-liste">
          {rows.map((a) => (
            <div key={a.id} className="pc-ligne leger">
              <span className="pc-pt pc-c-info"><Icone nom={a.icone} /></span>
              <span className="pc-txt">
                <b>{a.texte}</b>
                <small>{quand(a.createdAt)}{a.auteur ? ` · ${a.auteur}` : ''}</small>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
