'use client';

// VILLE & RÈGLEMENTS — exigences de la Municipalité de Trois-Rives, de la MRC de Mékinac
// et de la bande riveraine (terrain riverain du lac Mékinac). Tout reste « à confirmer »
// avec l'inspecteur municipal tant que ce n'est pas marqué confirmé.
// Routes : GET/POST/PATCH/DELETE /projet-chalet/reglements (écriture = propriétaires).

import { useCallback, useEffect, useState } from 'react';
import { ProjetChaletAPI, type Reglement } from '@/lib/projet-chalet-api';
import { useChalet, Icone, Chip, Vide, Erreur, Chargement, Feuille, Confirmer, Champ, Entete, type EcranProps } from '../_kit/ui';

const STATUTS: Record<Reglement['statut'], { v: 'warn' | 'ok' | 'neutre'; libelle: string }> = {
  A_CONFIRMER: { v: 'warn', libelle: 'À confirmer' },
  CONFIRME: { v: 'ok', libelle: 'Confirmé' },
  NON_APPLICABLE: { v: 'neutre', libelle: 'Ne s’applique pas' },
};

type Brouillon = { id?: number; titre: string; source: string; lien: string; detail: string; statut: Reglement['statut'] };
const VIDE: Brouillon = { titre: '', source: '', lien: '', detail: '', statut: 'A_CONFIRMER' };

export default function Reglements(_: EcranProps) {
  const { proprio, toast } = useChalet();
  const [rows, setRows] = useState<Reglement[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [form, setForm] = useState<Brouillon | null>(null);
  const [ouvert, setOuvert] = useState<Reglement | null>(null);
  const [aSupprimer, setASupprimer] = useState<Reglement | null>(null);

  const charger = useCallback(async () => {
    try { setRows((await ProjetChaletAPI.reglements()).reglements); } catch (e: any) { setErreur(e?.message || 'Erreur de chargement.'); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function enregistrer() {
    if (!form || !form.titre.trim()) return;
    const body = { titre: form.titre.trim(), source: form.source || null, lien: form.lien || null, detail: form.detail || null, statut: form.statut };
    try {
      if (form.id) await ProjetChaletAPI.majReglement(form.id, body);
      else await ProjetChaletAPI.creerReglement(body);
      toast('Enregistré');
      setForm(null);
      await charger();
    } catch (e: any) {
      setErreur(e?.message || 'Enregistrement impossible.');
    }
  }

  return (
    <>
      <Entete titre="Ville & règlements" />
      <p className="pc-muted pc-petit" style={{ marginTop: -8 }}>
        Autorité : Municipalité de Trois-Rives + MRC de Mékinac. Terrain riverain : règles de bande riveraine en plus.
      </p>
      <Erreur message={erreur} />
      {!rows ? <Chargement /> : rows.length === 0 ? <Vide>Aucun règlement noté.</Vide> : (
        <div className="pc-liste">
          {rows.map((r) => (
            <button key={r.id} className="pc-ligne" onClick={() => setOuvert(r)}>
              <span className="pc-pt pc-c-warn"><Icone nom="scale-balanced" /></span>
              <span className="pc-txt"><b>{r.titre}</b>{r.source && <small>{r.source}</small>}</span>
              <Chip v={STATUTS[r.statut].v}>{STATUTS[r.statut].libelle}</Chip>
            </button>
          ))}
        </div>
      )}
      {proprio && <button className="pc-btn second" style={{ marginTop: 10 }} onClick={() => setForm({ ...VIDE })}><Icone nom="plus" /> Ajouter un règlement</button>}

      {ouvert && (
        <Feuille titre={ouvert.titre} onFermer={() => setOuvert(null)}>
          <div className="pc-rangee" style={{ marginBottom: 8 }}><Chip v={STATUTS[ouvert.statut].v}>{STATUTS[ouvert.statut].libelle}</Chip>{ouvert.source && <span className="pc-muted pc-petit">{ouvert.source}</span>}</div>
          {ouvert.detail && <p style={{ whiteSpace: 'pre-wrap' }}>{ouvert.detail}</p>}
          {ouvert.lien && <p><a href={ouvert.lien} target="_blank" rel="noopener">Ouvrir la source <Icone nom="arrow-up-right-from-square" /></a></p>}
          {proprio && (
            <div className="pc-rangee">
              <button className="pc-btn petit" onClick={() => { setForm({ id: ouvert.id, titre: ouvert.titre, source: ouvert.source || '', lien: ouvert.lien || '', detail: ouvert.detail || '', statut: ouvert.statut }); setOuvert(null); }}><Icone nom="pen" /> Modifier</button>
              <button className="pc-btn petit danger" onClick={() => { setASupprimer(ouvert); setOuvert(null); }}><Icone nom="trash" /> Supprimer</button>
            </div>
          )}
        </Feuille>
      )}

      {form && (
        <Feuille titre={form.id ? 'Modifier le règlement' : 'Nouveau règlement'} onFermer={() => setForm(null)}>
          <Champ id="r-titre" label="Exigence"><input id="r-titre" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} /></Champ>
          <Champ id="r-source" label="Source (municipalité, MRC, Québec…)"><input id="r-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Champ>
          <Champ id="r-lien" label="Lien"><input id="r-lien" type="url" value={form.lien} onChange={(e) => setForm({ ...form, lien: e.target.value })} /></Champ>
          <Champ id="r-detail" label="Détails"><textarea id="r-detail" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></Champ>
          <Champ id="r-statut" label="Statut">
            <select id="r-statut" value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value as Reglement['statut'] })}>
              {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.libelle}</option>)}
            </select>
          </Champ>
          <button className="pc-btn" onClick={enregistrer} disabled={!form.titre.trim()}>Enregistrer</button>
        </Feuille>
      )}

      {aSupprimer && (
        <Confirmer
          message={`Supprimer « ${aSupprimer.titre} » ?`}
          onNon={() => setASupprimer(null)}
          onOui={async () => {
            try { await ProjetChaletAPI.supprimerReglement(aSupprimer.id); toast('Supprimé'); } catch (e: any) { setErreur(e?.message || 'Impossible.'); }
            setASupprimer(null);
            await charger();
          }}
        />
      )}
    </>
  );
}
