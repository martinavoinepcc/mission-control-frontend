'use client';

// =====================================================================
// PROJET CHALET — Pièces (port de public/chalet-pieces.html « Notre Chalet »)
// ---------------------------------------------------------------------
// Écrans (adresse → composant) :
//   #pieces        → Pieces      : étages RDC / RDJ / Extérieur, plan d'étage dépliable,
//                                  « Le look final », liste des pièces, saisie rapide (+ Ajouter).
//   #piece/<slug>  → PieceFiche  : extrait de plan (plein écran), cotes, Requis / Commentaires /
//                                  Inspirations avec votes « Moi aussi ! », réponses et suppression.
//
// Routes API utilisées :
//   GET    /projet-chalet/pieces            ProjetChaletAPI.pieces()   → { pieces: Piece[] } (table Piece)
//   GET    /pieces/entries                  PiecesAPI.entrees()        → PieceEntry[] (tableau brut)
//   POST   /pieces/entries                  PiecesAPI.ajouter()        (texte ou photoData webp)
//   PATCH  /pieces/entries/:id              PiecesAPI.maj({ done })    (cocher un requis)
//   POST   /pieces/entries/:id/like         PiecesAPI.aimer()          (bascule MON prénom dans likes)
//   POST   /pieces/entries/:id/reply        PiecesAPI.repondre()       (replies = [{ t, by, ts }])
//   DELETE /pieces/entries/:id              PiecesAPI.supprimer()
//   GET    /pieces/photo/:id?token=         PiecesAPI.photoUrl()       (<img> d'une inspiration)
//
// IMPORTANT : PieceEntry.pieceId = Piece.slug (l'ancien identifiant de chalet-pieces.html,
// ex. « cuisine », « chambre-1 »). C'est ce lien qui garde toutes les entrées existantes
// attachées à leur pièce : ne jamais utiliser Piece.id (numérique) comme pieceId.
//
// Les pièces viennent de la BD (plus de liste ROOMS en dur). Les images d'extrait de plan
// et de plan d'étage sont des fichiers statiques dans /mockups/pieces-img/.
// Invité (proprio = false) : lecture seule (pas d'ajout, cocher, voter, répondre, supprimer).
// Rafraîchissement auto : toutes les 60 s + au retour sur l'onglet (l'autre voit tes ajouts).
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ProjetChaletAPI, PiecesAPI, type Piece, type PieceEntry, type PieceEntryKind } from '@/lib/projet-chalet-api';
import { compressImage } from '@/lib/chantier-api';
import { Icone, Entete, Chip, Vide, Erreur, Chargement, Feuille, Confirmer, Champ, useChalet, type EcranProps } from '../_kit/ui';

// ---------- Constantes ----------

const IMG = '/mockups/pieces-img/';
const MAX_PHOTO = 2.5 * 1024 * 1024; // le backend refuse au-delà de 2,5 Mo
const RAFRAICHIR_MS = 60_000;

type Etage = Piece['etage'];
const ETAGES: Array<{ cle: Etage; nom: string; plan: string | null }> = [
  { cle: 'RDC', nom: 'Rez-de-chaussée', plan: 'plan-rdc.jpg' },
  { cle: 'RDJ', nom: 'Rez-de-jardin', plan: 'plan-rdj.jpg' },
  { cle: 'EXT', nom: 'Extérieur', plan: null },
];
const CLE_ETAGE = 'pc_pieces_etage'; // étage choisi, mémorisé sur l'appareil (simple confort)

// « Le look final du chalet » — 6 images de référence (fichiers dans /public/images/look-final/).
// TODO : à migrer en BD plus tard (pas encore servi par l'API ; repris tel quel de chalet-pieces.html).
const LOOK_FINAL: Array<{ src: string; titre: string; detail: string }> = [
  { src: '/images/look-final/01-facade-entree.jpg', titre: 'Façade — entrée et garage', detail: 'Bois pâle horizontal, tôle noire, allée de gravier' },
  { src: '/images/look-final/02-facade-lac.jpg', titre: 'Façade — côté lac', detail: 'Fenestration pleine hauteur, poutres apparentes, terrasses superposées' },
  { src: '/images/look-final/03-salon.jpg', titre: 'Salon · séjour cathédrale', detail: 'Foyer de pierre 2 faces, plafond lattes bois, banquette fenêtre' },
  { src: '/images/look-final/04-cuisine.jpg', titre: 'Cuisine', detail: 'Chêne clair + hauts crème, dosseret feuillage vitré, îlot capsule lattes + pierre, cellier vitré' },
  { src: '/images/look-final/05-sdb-alizee.jpg', titre: 'Salle de bain d’Alizée — attenante à sa chambre', detail: 'Miroir rond rétroéclairé, lattes de bois, douche italienne, accents dorés' },
  { src: '/images/look-final/06-sdb-sous-sol.jpg', titre: 'Salles de bain du sous-sol (RDJ)', detail: 'Même ton chaleureux : bois naturel, pierre beige, lumière douce' },
];

const TYPES: Array<{ kind: PieceEntryKind; libelle: string; icone: string }> = [
  { kind: 'REQUIS', libelle: 'Requis', icone: 'list-check' },
  { kind: 'COMMENTAIRE', libelle: 'Commentaire', icone: 'comment' },
  { kind: 'INSPIRATION', libelle: 'Inspiration', icone: 'image' },
];

// ---------- Utilitaires ----------

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Erreur inattendue.';
}

function dateJour(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

function nomPiece(p: Piece): string {
  return (p.numero ? p.numero + ' · ' : '') + p.nom;
}

// Couleur du prénom (comme l'ancienne app : MJ en rouge, Martin en bleu lac).
function couleurAuteur(nom: string): string {
  return nom === 'MJ' ? 'var(--pc-bad)' : 'var(--pc-lac)';
}

function lireEtage(): Etage {
  try {
    const v = localStorage.getItem(CLE_ETAGE);
    if (v === 'RDC' || v === 'RDJ' || v === 'EXT') return v;
  } catch { /* stockage bloqué : RDC par défaut */ }
  return 'RDC';
}

// Photo → data URL webp ≤ 2,5 Mo (mêmes réglages que l'app chantier).
async function preparerPhoto(file: File): Promise<string> {
  const { dataUrl } = await compressImage(file, 1100, 0.72);
  if (dataUrl.length > MAX_PHOTO) throw new Error('Photo trop lourde, même compressée (max 2,5 Mo).');
  return dataUrl;
}

// ---------- Données partagées par les 2 écrans ----------
// Charge les pièces + toutes les entrées, puis rafraîchit aux 60 s et au retour d'onglet.
function useDonneesPieces() {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [entrees, setEntrees] = useState<PieceEntry[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async (silencieux: boolean) => {
    try {
      const [p, e] = await Promise.all([ProjetChaletAPI.pieces(), PiecesAPI.entrees()]);
      setPieces([...p.pieces].sort((a, b) => a.ordre - b.ordre));
      setEntrees(Array.isArray(e) ? e : []);
      setErreur(null);
    } catch (err) {
      if (!silencieux) setErreur(msg(err)); // un rafraîchissement raté ne casse pas l'écran
    }
  }, []);

  useEffect(() => {
    charger(false);
    const t = window.setInterval(() => charger(true), RAFRAICHIR_MS);
    const vis = () => { if (!document.hidden) charger(true); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [charger]);

  // Remplace une entrée après PATCH / like / reply. Ces réponses n'incluent pas toujours
  // hasPhoto : on garde l'ancienne valeur (même logique que replaceEntry de l'ancienne app).
  const remplacer = useCallback((u: PieceEntry) => {
    setEntrees((xs) => (xs || []).map((x) => (x.id === u.id ? { ...u, hasPhoto: u.hasPhoto ?? x.hasPhoto } : x)));
  }, []);
  const ajouter = useCallback((e: PieceEntry) => setEntrees((xs) => [...(xs || []), e]), []);
  const retirer = useCallback((id: number) => setEntrees((xs) => (xs || []).filter((x) => x.id !== id)), []);

  return { pieces, entrees, erreur, remplacer, ajouter, retirer };
}

// ---------- Plein écran (plans, photos) ----------
// Toucher l'image bascule le zoom (200 %, défilable). Fermer = bouton, Échap ou toucher le voile.
function PleinEcran({ src, alt, legende, onFermer }: { src: string; alt: string; legende?: string; onFermer: () => void }) {
  const [zoom, setZoom] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', k);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [onFermer]);
  return (
    <div className="pc-voile" style={{ alignItems: 'center', padding: 12 }} onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className="pc-lecteur" role="dialog" aria-modal="true" aria-label={alt} tabIndex={-1} ref={ref} style={{ width: '100%', maxWidth: 900 }}>
        <div className="pc-rangee" style={{ justifyContent: 'space-between', padding: '6px 8px' }}>
          <span className="pc-petit pc-muted">{zoom ? 'Touche l’image pour dézoomer' : 'Touche l’image pour zoomer'}</span>
          <button className="pc-icobtn" onClick={onFermer} aria-label="Fermer"><Icone nom="xmark" /></button>
        </div>
        <div style={{ overflow: 'auto', maxHeight: '78dvh' }}>
          <img
            src={src}
            alt={alt}
            onClick={() => setZoom((z) => !z)}
            style={{ width: zoom ? '200%' : '100%', maxWidth: 'none', display: 'block', cursor: zoom ? 'zoom-out' : 'zoom-in' }}
          />
        </div>
        {legende && <div className="pc-petit pc-muted" style={{ padding: '7px 10px' }}>{legende}</div>}
      </div>
    </div>
  );
}

// ---------- Saisie rapide : type → pièce → texte / photo ----------
function SaisieRapide({ pieces, slugDefaut, onFermer, onAjout }: {
  pieces: Piece[];
  slugDefaut?: string;
  onFermer: () => void;
  onAjout: (e: PieceEntry) => void;
}) {
  const { toast } = useChalet();
  const [kind, setKind] = useState<PieceEntryKind>('REQUIS');
  const [slug, setSlug] = useState(slugDefaut || pieces[0]?.slug || '');
  const [texte, setTexte] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async (ev: FormEvent) => {
    ev.preventDefault();
    const t = texte.trim();
    const avecPhoto = kind === 'INSPIRATION' && !!photo;
    if (!slug) { setErreur('Choisis une pièce.'); return; }
    if (!t && !avecPhoto) { setErreur('Écris ton idée d’abord.'); return; }
    setOccupe(true); setErreur(null);
    try {
      const photoData = avecPhoto && photo ? await preparerPhoto(photo) : undefined;
      const e = await PiecesAPI.ajouter({ pieceId: slug, kind, text: t, photoData });
      onAjout(photoData ? { ...e, hasPhoto: true } : e);
      const p = pieces.find((x) => x.slug === slug);
      toast(`Ajouté dans ${p ? p.nom : 'la pièce'} ✓`);
      onFermer();
    } catch (err) {
      setErreur(msg(err));
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Feuille titre="Vite, avant d’oublier !" onFermer={onFermer}>
      <form onSubmit={envoyer}>
        <div className="pc-segment" role="group" aria-label="Type d’ajout">
          {TYPES.map((t) => (
            <button key={t.kind} type="button" className={kind === t.kind ? 'on' : ''} aria-pressed={kind === t.kind} onClick={() => setKind(t.kind)}>
              <Icone nom={t.icone} /> {t.libelle}
            </button>
          ))}
        </div>
        <Champ id="qc-piece" label="Pièce">
          <select id="qc-piece" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {ETAGES.map((et) => {
              const ps = pieces.filter((p) => p.etage === et.cle);
              if (!ps.length) return null;
              return (
                <optgroup key={et.cle} label={et.nom}>
                  {ps.map((p) => <option key={p.slug} value={p.slug}>{nomPiece(p)}</option>)}
                </optgroup>
              );
            })}
          </select>
        </Champ>
        <Champ id="qc-texte" label={kind === 'INSPIRATION' ? 'Ton idée (facultatif avec une photo)' : 'Ton idée'}>
          <textarea id="qc-texte" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Écris ton idée ici…" />
        </Champ>
        {kind === 'INSPIRATION' && (
          <label className="pc-depose" style={{ marginBottom: 12 }}>
            <Icone nom="camera" /> {photo ? photo.name : 'Ajouter une photo'}
            <input type="file" accept="image/*" aria-label="Photo d’inspiration" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
          </label>
        )}
        <Erreur message={erreur} />
        <div className="pc-rangee" style={{ marginTop: 10 }}>
          <button type="submit" className="pc-btn" style={{ flex: 1 }} disabled={occupe}>
            {occupe ? <Icone nom="circle-notch" className="fa-spin" /> : <Icone nom="plus" />} Ajouter
          </button>
          <button type="button" className="pc-btn second" style={{ flex: 1 }} onClick={onFermer}>Annuler</button>
        </div>
      </form>
    </Feuille>
  );
}

// ---------- « Le look final du chalet » ----------
function LookFinal({ onFermer }: { onFermer: () => void }) {
  return (
    <Feuille titre="Le look final" onFermer={onFermer}>
      <div className="pc-note-claude" style={{ marginTop: 0, marginBottom: 14 }}>
        <Icone nom="star" /> Le <b>ton général harmonisé</b> du chalet : bois chaleureux, pierre grise/beige, noir mat,
        lumière douce. Toutes les pièces — sous-sol inclus — suivent cette direction.
      </div>
      {LOOK_FINAL.map((l) => (
        <figure key={l.src} className="pc-lecteur" style={{ margin: '0 0 14px' }}>
          <img src={l.src} alt={l.titre} loading="lazy" />
          <figcaption style={{ padding: '9px 12px' }}>
            <b>{l.titre}</b>
            <div className="pc-petit pc-muted">{l.detail}</div>
          </figcaption>
        </figure>
      ))}
      <button className="pc-btn second" onClick={onFermer}>Fermer</button>
    </Feuille>
  );
}

// =====================================================================
// ÉCRAN 1 — Liste des pièces (#pieces)
// =====================================================================
export function Pieces(_props: EcranProps) {
  const { aller, proprio } = useChalet();
  const { pieces, entrees, erreur, ajouter } = useDonneesPieces();
  const [etage, setEtageState] = useState<Etage>('RDC');
  const [planOuvert, setPlanOuvert] = useState(false);
  const [look, setLook] = useState(false);
  const [saisie, setSaisie] = useState(false);

  useEffect(() => { setEtageState(lireEtage()); }, []);
  const setEtage = (e: Etage) => {
    setEtageState(e);
    setPlanOuvert(false);
    try { localStorage.setItem(CLE_ETAGE, e); } catch { /* ignoré */ }
  };

  // Compteurs par pièce (requis ouverts / total, commentaires, inspirations) + progression globale.
  const stats = useMemo(() => {
    const parPiece = new Map<string, { req: number; ouverts: number; com: number; ins: number }>();
    let tot = 0, faits = 0;
    for (const e of entrees || []) {
      const s = parPiece.get(e.pieceId) || { req: 0, ouverts: 0, com: 0, ins: 0 };
      if (e.kind === 'REQUIS') { s.req++; tot++; if (e.done) faits++; else s.ouverts++; }
      else if (e.kind === 'COMMENTAIRE') s.com++;
      else s.ins++;
      parPiece.set(e.pieceId, s);
    }
    return { parPiece, tot, faits };
  }, [entrees]);

  const infoEtage = ETAGES.find((x) => x.cle === etage) || ETAGES[0];
  const visibles = (pieces || []).filter((p) => p.etage === etage);

  return (
    <>
      <Entete
        titre="Pièces"
        actions={proprio && pieces && pieces.length > 0 ? (
          <button className="pc-btn petit" onClick={() => setSaisie(true)} aria-label="Ajouter rapidement un requis, commentaire ou inspiration">
            <Icone nom="plus" /> Ajouter
          </button>
        ) : undefined}
      />
      <Erreur message={erreur} />
      {!erreur && (!pieces || !entrees) ? <Chargement /> : pieces && entrees && (
        <>
          {/* Progression globale des requis (ancien bandeau « Requis réglés ») */}
          <div className="pc-bande" style={{ marginBottom: 12 }}>
            <span>Requis réglés</span>
            <div className="pc-barre" role="progressbar" aria-label="Requis réglés" aria-valuemin={0} aria-valuemax={stats.tot} aria-valuenow={stats.faits}>
              <i style={{ width: `${stats.tot ? Math.round((stats.faits * 100) / stats.tot) : 0}%` }} />
            </div>
            <b className="pc-cote">{stats.faits} / {stats.tot}</b>
          </div>

          <div className="pc-segment" role="tablist" aria-label="Étage">
            {ETAGES.map((e) => (
              <button key={e.cle} role="tab" aria-selected={etage === e.cle} className={etage === e.cle ? 'on' : ''} onClick={() => setEtage(e.cle)}>
                {e.nom}
              </button>
            ))}
          </div>

          <div className="pc-rangee" style={{ marginBottom: 12 }}>
            <button className="pc-btn second petit" style={{ flex: 1 }} onClick={() => setLook(true)}>
              <Icone nom="star" /> Le look final
            </button>
            {infoEtage.plan && (
              <button className="pc-btn second petit" style={{ flex: 1 }} aria-expanded={planOuvert} aria-controls="pc-plan-etage" onClick={() => setPlanOuvert((o) => !o)}>
                <Icone nom="map" /> {planOuvert ? 'Cacher le plan' : 'Plan de l’étage'}
              </button>
            )}
          </div>

          {infoEtage.plan && planOuvert && (
            <div id="pc-plan-etage" className="pc-lecteur" style={{ marginBottom: 12, overflow: 'auto', maxHeight: '60vh' }}>
              <img src={IMG + infoEtage.plan} alt={`Plan — ${infoEtage.nom}`} style={{ width: '160%', maxWidth: 'none' }} />
            </div>
          )}

          {visibles.length === 0 ? (
            <Vide>Aucune pièce pour cet étage.</Vide>
          ) : (
            <div className="pc-liste">
              {visibles.map((p) => {
                const s = stats.parPiece.get(p.slug);
                const ouverts = s ? s.ouverts : p.compte.requisOuverts;
                const nbReq = s ? s.req : 0;
                return (
                  <button key={p.slug} className="pc-ligne" onClick={() => aller('piece', p.slug)}>
                    <span className="pc-pt pc-c-info" aria-hidden="true"><Icone nom={p.icone || 'door-open'} /></span>
                    <span className="pc-txt">
                      {p.numero && <span className="pc-surtitre">{p.numero}</span>}
                      <b>{p.nom}</b>
                      <small>
                        {p.cotes[0] && <><span className="pc-cote">{p.cotes[0]}</span>{p.qui ? ' · ' : ''}</>}
                        {p.qui}
                      </small>
                      {(s?.com || s?.ins) ? (
                        <span className="pc-rangee" style={{ marginTop: 4, gap: 6 }}>
                          {!!s?.com && <Chip><Icone nom="comment" /> {s.com}</Chip>}
                          {!!s?.ins && <Chip><Icone nom="image" /> {s.ins}</Chip>}
                        </span>
                      ) : null}
                    </span>
                    {ouverts > 0 ? (
                      <span aria-label={`${ouverts} requis à régler`}><Chip v="warn">{ouverts}</Chip></span>
                    ) : nbReq > 0 ? (
                      <span aria-label="Tous les requis sont réglés"><Chip v="ok"><Icone nom="check" /></Chip></span>
                    ) : null}
                    <Icone nom="chevron-right" className="pc-muted" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {look && <LookFinal onFermer={() => setLook(false)} />}
      {saisie && pieces && (
        <SaisieRapide pieces={pieces} onFermer={() => setSaisie(false)} onAjout={ajouter} />
      )}
    </>
  );
}

// =====================================================================
// ÉCRAN 2 — Fiche d'une pièce (#piece/<slug>)
// =====================================================================

// Ligne « Moi aussi ! » + « On le veut tous les deux » + bouton Répondre, puis le mini-fil.
function VotesEtReponses({ e, moi, proprio, onMaj }: {
  e: PieceEntry;
  moi: string;
  proprio: boolean;
  onMaj: (u: PieceEntry) => void;
}) {
  const { toast } = useChalet();
  const [filOuvert, setFilOuvert] = useState(false);
  const [rep, setRep] = useState('');
  const [occupe, setOccupe] = useState(false);
  const likes = Array.isArray(e.likes) ? e.likes : [];
  const replies = Array.isArray(e.replies) ? e.replies : [];
  const mien = likes.includes(moi);
  const lesDeux = likes.includes('Martin') && likes.includes('MJ');

  const voter = async () => {
    setOccupe(true);
    try {
      const u = await PiecesAPI.aimer(e.id);
      onMaj(u);
      const l = Array.isArray(u.likes) ? u.likes : [];
      if (l.includes('Martin') && l.includes('MJ')) toast('Vous le voulez tous les deux !');
    } catch (err) { toast(msg(err)); } finally { setOccupe(false); }
  };

  const repondre = async (ev: FormEvent) => {
    ev.preventDefault();
    const t = rep.trim();
    if (!t) return;
    setOccupe(true);
    try {
      onMaj(await PiecesAPI.repondre(e.id, t));
      setRep(''); setFilOuvert(false);
      toast('Réponse ajoutée ✓');
    } catch (err) { toast(msg(err)); } finally { setOccupe(false); }
  };

  const idRep = `pc-rep-${e.id}`;
  return (
    <>
      <div className="pc-rangee" style={{ marginTop: 8, gap: 6 }}>
        {proprio ? (
          <button
            className="pc-btn second petit"
            aria-pressed={mien}
            disabled={occupe}
            onClick={voter}
            style={mien ? { color: 'var(--pc-bad)', borderColor: 'var(--pc-bad)' } : undefined}
          >
            <Icone nom="heart" /> {mien ? 'Je le veux aussi' : 'Moi aussi !'}{likes.length ? ' · ' + likes.join(' + ') : ''}
          </button>
        ) : likes.length > 0 ? (
          <Chip><Icone nom="heart" /> {likes.join(' + ')}</Chip>
        ) : null}
        {lesDeux && <Chip v="warn"><Icone nom="heart" /> On le veut tous les deux</Chip>}
        {(proprio || replies.length > 0) && (
          <button className="pc-lien" aria-expanded={filOuvert} onClick={() => setFilOuvert((o) => !o)}>
            <Icone nom="reply" /> {proprio ? 'Répondre' : 'Réponses'}{replies.length ? ` (${replies.length})` : ''}
          </button>
        )}
      </div>
      {(replies.length > 0 || filOuvert) && (
        <div style={{ marginTop: 8, borderLeft: '3px solid var(--pc-ligne)', paddingLeft: 10 }}>
          {replies.map((r, i) => (
            <div key={i} className="pc-carte" style={{ marginBottom: 6, padding: '7px 10px' }}>
              <div className="pc-petit"><b style={{ color: couleurAuteur(r.by) }}>{r.by}</b>{r.ts ? <span className="pc-muted"> · {dateJour(r.ts)}</span> : null}</div>
              <div style={{ overflowWrap: 'anywhere' }}>{r.t}</div>
            </div>
          ))}
          {filOuvert && proprio && (
            <form className="pc-champ" style={{ marginBottom: 0 }} onSubmit={repondre}>
              <label htmlFor={idRep}>Ta réponse</label>
              <div className="pc-rangee" style={{ flexWrap: 'nowrap' }}>
                <input id={idRep} type="text" value={rep} autoFocus onChange={(ev) => setRep(ev.target.value)} placeholder="Répondre…" style={{ flex: 1, minWidth: 0 }} />
                <button type="submit" className="pc-btn petit" disabled={occupe || !rep.trim()} aria-label="Envoyer la réponse"><Icone nom="paper-plane" /></button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

// Champ d'ajout en une ligne (requis, commentaire, idée en mots).
function AjoutLigne({ id, label, placeholder, icone, onAjout }: {
  id: string;
  label: string;
  placeholder: string;
  icone: string;
  onAjout: (texte: string) => Promise<void>;
}) {
  const [v, setV] = useState('');
  const [occupe, setOccupe] = useState(false);
  const envoyer = async (ev: FormEvent) => {
    ev.preventDefault();
    const t = v.trim();
    if (!t) return;
    setOccupe(true);
    // En cas d'échec, le toast est déjà affiché par onAjout : on garde le texte pour réessayer.
    try { await onAjout(t); setV(''); } catch { /* texte conservé */ } finally { setOccupe(false); }
  };
  return (
    <form className="pc-champ" style={{ marginTop: 8 }} onSubmit={envoyer}>
      <label htmlFor={id}>{label}</label>
      <div className="pc-rangee" style={{ flexWrap: 'nowrap' }}>
        <input id={id} type="text" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} style={{ flex: 1, minWidth: 0 }} />
        <button type="submit" className="pc-btn petit" disabled={occupe || !v.trim()} aria-label={label}><Icone nom={icone} /></button>
      </div>
    </form>
  );
}

// Bouton corbeille (propriétaires seulement) → confirmation.
function BoutonSupprimer({ onClick }: { onClick: () => void }) {
  return (
    <button className="pc-icobtn" onClick={onClick} aria-label="Supprimer" style={{ color: 'var(--pc-gris)' }}>
      <Icone nom="trash-can" />
    </button>
  );
}

export function PieceFiche({ params }: EcranProps) {
  const slug = params[0] || '';
  const { toast, proprio, accueil } = useChalet();
  const moi = accueil?.moi.nom || '';
  const { pieces, entrees, erreur, remplacer, ajouter, retirer } = useDonneesPieces();
  const [pleinEcran, setPleinEcran] = useState<{ src: string; alt: string; legende?: string } | null>(null);
  const [aSupprimer, setASupprimer] = useState<PieceEntry | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);

  const piece = pieces?.find((p) => p.slug === slug) || null;
  const mesEntrees = useMemo(() => (entrees || []).filter((e) => e.pieceId === slug), [entrees, slug]);
  const requis = mesEntrees.filter((e) => e.kind === 'REQUIS');
  const commentaires = mesEntrees.filter((e) => e.kind === 'COMMENTAIRE');
  const inspirations = mesEntrees.filter((e) => e.kind === 'INSPIRATION');
  const ouverts = requis.filter((e) => !e.done).length;

  // Crée une entrée dans CETTE pièce (pieceId = slug).
  const creer = async (kind: PieceEntryKind, text: string, confirmation: string) => {
    try {
      ajouter(await PiecesAPI.ajouter({ pieceId: slug, kind, text }));
      toast(confirmation + ' ✓');
    } catch (err) { toast(msg(err)); throw err; }
  };

  const cocher = async (e: PieceEntry) => {
    try { remplacer(await PiecesAPI.maj(e.id, { done: !e.done })); }
    catch (err) { toast(msg(err)); }
  };

  const ajouterPhoto = async (file: File | undefined) => {
    if (!file) return;
    setEnvoiPhoto(true);
    toast('Compression de la photo…');
    try {
      const photoData = await preparerPhoto(file);
      const e = await PiecesAPI.ajouter({ pieceId: slug, kind: 'INSPIRATION', text: '', photoData });
      ajouter({ ...e, hasPhoto: true });
      toast('Photo ajoutée ✓');
    } catch (err) { toast(msg(err)); } finally { setEnvoiPhoto(false); }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    try {
      await PiecesAPI.supprimer(aSupprimer.id);
      retirer(aSupprimer.id);
      toast('Supprimé');
    } catch (err) { toast(msg(err)); }
    setASupprimer(null);
  };

  if (erreur) return <><Entete titre="Pièce" /><Erreur message={erreur} /></>;
  if (!pieces || !entrees) return <><Entete titre="Pièce" /><Chargement /></>;
  if (!piece) return <><Entete titre="Pièce" /><Erreur message="Pièce introuvable." /></>;

  const legendePlan = 'Extrait du plan TALO T-1860 (esquisses). À valider au chantier.';

  return (
    <>
      <Entete
        titre={piece.nom}
        actions={proprio ? (
          <button className="pc-icobtn" onClick={() => setSaisie(true)} aria-label="Ajout rapide">
            <Icone nom="plus" />
          </button>
        ) : undefined}
      />
      {(piece.numero || piece.qui) && (
        <p className="pc-muted pc-petit" style={{ margin: '-8px 0 12px' }}>
          {[piece.numero, piece.qui].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Extrait de plan : toucher = plein écran (zoomable) */}
      {piece.image && (
        <figure className="pc-lecteur" style={{ margin: '0 0 10px' }}>
          <button
            style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'none' }}
            onClick={() => setPleinEcran({ src: IMG + piece.image, alt: `Extrait du plan — ${piece.nom}`, legende: legendePlan })}
            aria-label={`Voir l’extrait du plan de ${piece.nom} en plein écran`}
          >
            <img src={IMG + piece.image} alt={`Extrait du plan — ${piece.nom}`} />
          </button>
          <figcaption className="pc-petit pc-muted" style={{ padding: '7px 10px' }}>
            <Icone nom="ruler-combined" /> {legendePlan} Touche pour agrandir.
          </figcaption>
        </figure>
      )}

      {piece.cotes.length > 0 && (
        <div className="pc-rangee" style={{ gap: 6 }}>
          {piece.cotes.map((c, i) => (
            <span key={i} className="pc-chip pc-c-info pc-cote" style={{ whiteSpace: 'normal' }}>{c}</span>
          ))}
        </div>
      )}

      {/* ----- Requis ----- */}
      <div className="pc-section-titre">
        <h3><Icone nom="list-check" /> Requis</h3>
        <span className="pc-petit pc-muted">{ouverts} à régler</span>
      </div>
      {requis.length === 0 && <Vide>Aucun requis pour l’instant. Ajoute ce qui doit absolument être prévu dans cette pièce.</Vide>}
      {requis.map((e) => {
        const idCase = `pc-req-${e.id}`;
        return (
          <div key={e.id} className="pc-carte">
            <div className="pc-case" style={{ alignItems: 'flex-start' }}>
              <input id={idCase} type="checkbox" checked={e.done} disabled={!proprio} onChange={() => cocher(e)} style={{ marginTop: 2 }} />
              <label htmlFor={idCase} style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', textDecoration: e.done ? 'line-through' : undefined, color: e.done ? 'var(--pc-gris)' : undefined }}>
                {e.text}
              </label>
              {proprio && <BoutonSupprimer onClick={() => setASupprimer(e)} />}
            </div>
            <div className="pc-petit pc-muted">{e.author} · {dateJour(e.createdAt)}</div>
            <VotesEtReponses e={e} moi={moi} proprio={proprio} onMaj={remplacer} />
          </div>
        );
      })}
      {proprio && (
        <AjoutLigne id="pc-ajout-requis" label="Ajouter un requis" placeholder="Ajouter un requis…" icone="plus"
          onAjout={(t) => creer('REQUIS', t, 'Requis ajouté')} />
      )}

      {/* ----- Commentaires ----- */}
      <div className="pc-section-titre">
        <h3><Icone nom="comments" /> Commentaires</h3>
      </div>
      {commentaires.length === 0 && <Vide>Rien encore. Note ici tes idées, questions, points à discuter.</Vide>}
      {commentaires.map((e) => (
        <div key={e.id} className="pc-carte">
          <div className="pc-rangee" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pc-petit"><b style={{ color: couleurAuteur(e.author) }}>{e.author}</b></div>
              <div style={{ overflowWrap: 'anywhere' }}>{e.text}</div>
              <div className="pc-petit pc-muted">{dateJour(e.createdAt)}</div>
            </div>
            {proprio && <BoutonSupprimer onClick={() => setASupprimer(e)} />}
          </div>
        </div>
      ))}
      {proprio && (
        <AjoutLigne id="pc-ajout-commentaire" label="Écrire un commentaire" placeholder="Écrire un commentaire…" icone="paper-plane"
          onAjout={(t) => creer('COMMENTAIRE', t, 'Commentaire ajouté')} />
      )}

      {/* ----- Inspirations ----- */}
      <div className="pc-section-titre">
        <h3><Icone nom="images" /> Inspirations</h3>
      </div>
      {inspirations.length === 0 && (
        <Vide>Photos de produits achetés, Pinterest, captures d’écran, photos en magasin… tout ce qui inspire pour cette pièce.</Vide>
      )}
      {inspirations.map((e) => {
        const url = e.hasPhoto ? PiecesAPI.photoUrl(e.id) : null;
        return (
          <div key={e.id} className="pc-carte">
            {url && (
              <button
                style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'none', marginBottom: 6 }}
                onClick={() => setPleinEcran({ src: url, alt: e.text || `Inspiration de ${e.author}` })}
                aria-label="Voir la photo en plein écran"
              >
                <img src={url} alt={e.text || `Inspiration de ${e.author}`} loading="lazy" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', borderRadius: 10 }} />
              </button>
            )}
            <div className="pc-rangee" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {e.text && <div style={{ overflowWrap: 'anywhere' }}>{e.text}</div>}
                <div className="pc-petit pc-muted">{e.author} · {dateJour(e.createdAt)}</div>
              </div>
              {proprio && <BoutonSupprimer onClick={() => setASupprimer(e)} />}
            </div>
            <VotesEtReponses e={e} moi={moi} proprio={proprio} onMaj={remplacer} />
          </div>
        );
      })}
      {proprio && (
        <>
          <label className="pc-depose" style={{ marginTop: 8 }}>
            {envoiPhoto ? <Icone nom="circle-notch" className="fa-spin" /> : <Icone nom="camera" />} Ajouter une photo
            <input
              type="file"
              accept="image/*"
              aria-label="Ajouter une photo d’inspiration"
              disabled={envoiPhoto}
              onChange={(ev) => { ajouterPhoto(ev.target.files?.[0]); ev.target.value = ''; }}
            />
          </label>
          <AjoutLigne id="pc-ajout-inspiration" label="Ou une idée en mots" placeholder="Ou une idée en mots…" icone="plus"
            onAjout={(t) => creer('INSPIRATION', t, 'Inspiration notée')} />
        </>
      )}

      {pleinEcran && <PleinEcran {...pleinEcran} onFermer={() => setPleinEcran(null)} />}
      {aSupprimer && (
        <Confirmer message="Supprimer cet élément pour vous deux ?" onOui={supprimer} onNon={() => setASupprimer(null)} />
      )}
      {saisie && (
        <SaisieRapide pieces={pieces} slugDefaut={slug} onFermer={() => setSaisie(false)} onAjout={ajouter} />
      )}
    </>
  );
}
