'use client';

// BOÎTE DE DÉPÔT — on dépose un fichier (plan, soumission, facture, photo, carte
// d'affaires…) + une phrase de description. Claude classe 4 fois par jour
// (8 h, 12 h, 18 h, 22 h, heure de Montréal) via la tâche planifiée qui appelle
// /projet-chalet/classeur/* (voir backend src/routes/projet-chalet.js).
//
// Statuts : EN_ATTENTE (pas encore classé) → CLASSE (rangé, avec la raison de Claude)
//           ou A_VALIDER (Claude propose ; un propriétaire confirme ou corrige).
// Routes : GET/POST /projet-chalet/depot, POST /depot/:id/valider, POST /depot/:id/corriger,
//          DELETE /depot/:id, GET /depot/:id/fichier.

import { useCallback, useEffect, useState } from 'react';
import { ProjetChaletAPI, lireFichier, quand, type Depot as DepotT } from '@/lib/projet-chalet-api';
import { compressImage, fmtSize } from '@/lib/chantier-api';
import { useChalet, Icone, Chip, Vide, Erreur, Chargement, Feuille, Confirmer, Champ, EnteteSimple, type EcranProps } from '../_kit/ui';

const MAX_OCTETS = 40 * 1024 * 1024; // même limite que le backend

const STATUT: Record<DepotT['statut'], { v: 'warn' | 'info' | 'ok'; libelle: string }> = {
  EN_ATTENTE: { v: 'warn', libelle: 'En attente' },
  A_VALIDER: { v: 'info', libelle: 'À valider' },
  CLASSE: { v: 'ok', libelle: 'Classé' },
};

export default function Depot(_: EcranProps) {
  const { proprio, toast, recharger } = useChalet();
  const [depots, setDepots] = useState<DepotT[] | null>(null);
  const [prochain, setProchain] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [aCorriger, setACorriger] = useState<DepotT | null>(null);
  const [consigne, setConsigne] = useState('');
  const [aAnnuler, setAAnnuler] = useState<DepotT | null>(null);

  const charger = useCallback(async () => {
    try {
      const r = await ProjetChaletAPI.depots();
      setDepots(r.depots);
      setProchain(r.prochainClassement);
    } catch (e: any) {
      setErreur(e?.message || 'Erreur de chargement.');
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function deposer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!fichier && !description.trim()) { setErreur('Ajoute un fichier ou une description.'); return; }
    if (fichier && fichier.size > MAX_OCTETS) { setErreur('Fichier trop gros (40 Mo maximum).'); return; }
    setEnvoi(true);
    try {
      let fileData: string | undefined;
      let mimeType = fichier?.type || undefined;
      if (fichier) {
        // Les grosses photos sont allégées (webp) pour ménager la base ; les PDF restent intacts.
        if (fichier.type.startsWith('image/') && fichier.size > 1.5 * 1024 * 1024) {
          fileData = (await compressImage(fichier, 2200, 0.82)).dataUrl;
          mimeType = 'image/webp';
        } else {
          fileData = await lireFichier(fichier);
        }
      }
      const r = await ProjetChaletAPI.deposer({ description: description.trim(), fileName: fichier?.name, mimeType, fileData });
      setFichier(null);
      setDescription('');
      toast(`Déposé · classement à ${r.prochainClassement}`);
      await Promise.all([charger(), recharger()]);
    } catch (e: any) {
      setErreur(e?.message || 'Le dépôt a échoué.');
    } finally {
      setEnvoi(false);
    }
  }

  async function valider(d: DepotT) {
    try {
      await ProjetChaletAPI.valider(d.id);
      toast('Classé');
      await Promise.all([charger(), recharger()]);
    } catch (e: any) {
      setErreur(e?.message || 'Validation impossible.');
    }
  }

  async function envoyerCorrection() {
    if (!aCorriger || !consigne.trim()) return;
    try {
      await ProjetChaletAPI.corriger(aCorriger.id, consigne.trim());
      toast(`Noté : Claude le reclassera à ${prochain}`);
      setACorriger(null);
      setConsigne('');
      await charger();
    } catch (e: any) {
      setErreur(e?.message || 'Correction impossible.');
    }
  }

  return (
    <>
      <EnteteSimple titre="Boîte de dépôt" />

      <form onSubmit={deposer}>
        <label className="pc-depose" htmlFor="depot-fichier">
          <Icone nom="cloud-arrow-up" /><br />
          <b>{fichier ? fichier.name : 'Choisir un fichier ou une photo'}</b><br />
          <small>{fichier ? fmtSize(fichier.size) : "Plan, soumission, facture, photo, carte d'affaires…"}</small>
          <input id="depot-fichier" type="file" onChange={(e) => setFichier(e.target.files?.[0] || null)} />
        </label>
        <div style={{ height: 12 }} />
        <Champ id="depot-desc" label="Décris-le en une phrase (ça aide Claude à bien classer)">
          <textarea id="depot-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex. : Soumission du plombier pour la SDB d'Alizée" />
        </Champ>
        <button className="pc-btn" type="submit" disabled={envoi}>
          <Icone nom={envoi ? 'circle-notch' : 'paper-plane'} className={envoi ? 'fa-spin' : undefined} /> {envoi ? 'Envoi…' : 'Déposer'}
        </button>
      </form>

      <div style={{ marginTop: 12 }}><Erreur message={erreur} /></div>

      <div className="pc-section-titre"><h3>{proprio ? 'Dépôts' : 'Mes dépôts'}</h3></div>
      <p className="pc-muted pc-petit" style={{ margin: '-4px 0 10px' }}>
        Claude classe à 8 h, 12 h, 18 h et 22 h. Prochain classement : {prochain || '…'}.
      </p>

      {!depots ? <Chargement /> : depots.length === 0 ? <Vide>Rien de déposé pour l'instant.</Vide> : depots.map((d) => (
        <div key={d.id} className="pc-carte">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span className="pc-pt pc-c-neutre"><Icone nom={d.mimeType?.startsWith('image/') ? 'image' : d.docId ? 'file-lines' : 'note-sticky'} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{d.fileName || 'Note'}</b>
              <div className="pc-muted" style={{ fontSize: 13 }}>« {d.description} »</div>
            </div>
            <Chip v={STATUT[d.statut].v}>{STATUT[d.statut].libelle}</Chip>
          </div>
          {d.destination && (
            <div className="pc-note-claude">
              <b><Icone nom="wand-magic-sparkles" /> {d.destination}</b>
              {d.raison && <><br />{d.raison}</>}
            </div>
          )}
          {d.correction && d.statut === 'EN_ATTENTE' && (
            <div className="pc-note-claude">Consigne pour Claude : {d.correction}</div>
          )}
          {proprio && d.statut === 'A_VALIDER' && (
            <div className="pc-rangee" style={{ marginTop: 8 }}>
              <button className="pc-btn petit" onClick={() => valider(d)}><Icone nom="check" /> C'est ça</button>
              <button className="pc-btn petit second" onClick={() => { setACorriger(d); setConsigne(''); }}>Corriger</button>
            </div>
          )}
          <div className="pc-meta">
            <span>{d.auteurNom} · {quand(d.createdAt)}{d.classePar ? ` · classé par ${d.classePar}` : ''}</span>
            <span className="pc-rangee">
              {d.docId && <a className="pc-lien" href={ProjetChaletAPI.fichierDepot(d.id)} target="_blank" rel="noopener">Voir</a>}
              {d.statut === 'EN_ATTENTE' && <button className="pc-lien" onClick={() => setAAnnuler(d)}>Annuler</button>}
            </span>
          </div>
        </div>
      ))}

      {aCorriger && (
        <Feuille titre="Où ça va ?" onFermer={() => setACorriger(null)}>
          <p className="pc-muted pc-petit" style={{ marginTop: 0 }}>
            Dis-le en une phrase. Claude le reclassera au prochain passage ({prochain}) en suivant ta consigne.
          </p>
          <Champ id="consigne" label="Consigne">
            <textarea id="consigne" value={consigne} onChange={(e) => setConsigne(e.target.value)} placeholder="Ex. : C'est pour la SDB d'Alizée, pas celle des maîtres" />
          </Champ>
          <button className="pc-btn" onClick={envoyerCorrection} disabled={!consigne.trim()}>Envoyer</button>
        </Feuille>
      )}

      {aAnnuler && (
        <Confirmer
          message={`Annuler le dépôt « ${aAnnuler.fileName || aAnnuler.description} » ? Le fichier sera retiré.`}
          libelle="Annuler le dépôt"
          onNon={() => setAAnnuler(null)}
          onOui={async () => {
            try {
              await ProjetChaletAPI.annulerDepot(aAnnuler.id);
              toast('Dépôt annulé');
              setAAnnuler(null);
              await Promise.all([charger(), recharger()]);
            } catch (e: any) {
              setErreur(e?.message || 'Annulation impossible.');
              setAAnnuler(null);
            }
          }}
        />
      )}
    </>
  );
}
