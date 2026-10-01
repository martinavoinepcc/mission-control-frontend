'use client';

// =====================================================================
// PHOTOS — écran « photos » de Projet chalet (tuile « photos »).
// ---------------------------------------------------------------------
// Porté de l'ancienne app Chantier (PhotosView + PhotoFormModal, partie photo).
//  - Grille de vignettes ; toucher une photo = feuille avec la photo en grand,
//    sa date, son jalon, Télécharger et (propriétaire) Supprimer avec confirmation.
//  - Propriétaire : ajouter une ou plusieurs photos (caméra du téléphone ou galerie),
//    compressées en webp côté téléphone (compressImage) avant l'envoi, jalon optionnel.
//
// Routes API (lib/chantier-api.ts → backend src/routes/chantier.js) :
//  - GET    /chantier/docs?kind=PHOTO   → liste (métadonnées seulement, jamais le fichier)
//  - GET    /chantier/docs/:id/raw      → l'image (docFileUrl / docDownloadUrl, ?token=)
//  - POST   /chantier/docs              → ajout { kind:'PHOTO', title, fileData (data URL webp), ... }
//  - DELETE /chantier/docs/:id          → suppression
//  - GET    /chantier/jalons            → noms des jalons (facultatif : un invité sans la
//                                         tuile Jalons reçoit 403, on affiche alors « — »)
// Invité : lecture seule (le backend bloque aussi toute écriture).
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ChantierAPI, compressImage, docFileUrl, docDownloadUrl, type Doc, type JalonLite } from '@/lib/chantier-api';
import {
  useChalet, Entete, Icone, Vide, Erreur, Chargement, Feuille, Confirmer, Champ,
  dateCourte, type EcranProps,
} from '../_kit/ui';

const MAX_MO = 40; // même limite que l'ancienne app (le serveur refuse au-delà de ~40 Mo)
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Erreur inattendue.');

export default function Photos(_: EcranProps) {
  const { toast, proprio } = useChalet();

  const [photos, setPhotos] = useState<Doc[] | null>(null);
  const [jalons, setJalons] = useState<JalonLite[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<number | null>(null); // index dans photos
  const [ajout, setAjout] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Doc | null>(null);

  // Callbacks STABLES : la Feuille refocalise à chaque changement de onFermer.
  const fermerVisionneuse = useCallback(() => setOuverte(null), []);
  const fermerAjout = useCallback(() => setAjout(false), []);
  const annulerSuppression = useCallback(() => setASupprimer(null), []);

  const charger = useCallback(async () => {
    try {
      setPhotos((await ChantierAPI.docs({ kind: 'PHOTO' })).docs);
      setErreur(null);
    } catch (e) { setErreur(msg(e)); }
  }, []);

  useEffect(() => {
    charger();
    // Noms des jalons : bonus, jamais bloquant (403 possible pour un invité).
    ChantierAPI.jalons().then((r) => setJalons(r.jalons)).catch(() => {});
  }, [charger]);

  const nomJalon = useMemo(() => {
    const m = new Map(jalons.map((j) => [j.id, j.name]));
    return (id: number | null) => (id ? m.get(id) || '—' : '—');
  }, [jalons]);

  async function supprimer(p: Doc) {
    try {
      await ChantierAPI.deleteDoc(p.id);
      toast('Photo supprimée');
      setASupprimer(null); setOuverte(null);
      await charger();
    } catch (e) { setErreur(msg(e)); setASupprimer(null); }
  }

  const actions = proprio ? (
    <button className="pc-icobtn" onClick={() => setAjout(true)} aria-label="Ajouter des photos">
      <Icone nom="camera" />
    </button>
  ) : undefined;

  if (photos === null) {
    return (<><Entete titre="Photos" actions={actions} />{erreur ? <Erreur message={erreur} /> : <Chargement />}</>);
  }

  const photo = ouverte !== null ? photos[ouverte] : null;

  return (
    <>
      <Entete titre="Photos" actions={actions} />
      <Erreur message={erreur} />

      {proprio && (
        <div style={{ margin: erreur ? '10px 0 12px' : '0 0 12px' }}>
          <button className="pc-btn" onClick={() => setAjout(true)}><Icone nom="camera" /> Prendre / ajouter des photos</button>
        </div>
      )}

      {photos.length === 0 ? (
        <Vide>Aucune photo pour l'instant.</Vide>
      ) : (
        <>
          <div className="pc-muted pc-petit" style={{ margin: '0 2px 8px' }}>{photos.length} photo{photos.length > 1 ? 's' : ''}</div>
          <div className="pc-grille-photos">
            {photos.map((p, i) => (
              <button key={p.id} onClick={() => setOuverte(i)} aria-label={`Ouvrir la photo « ${p.title} »`}>
                <img src={docFileUrl(p)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* ---------- Visionneuse ---------- */}
      {photo && ouverte !== null && (
        <Feuille titre={photo.title} onFermer={fermerVisionneuse}>
          <div className="pc-lecteur">
            <img src={docFileUrl(photo)} alt={photo.title} />
          </div>
          <div className="pc-meta">
            <span><Icone nom="calendar" /> {dateCourte(photo.takenAt || photo.createdAt)}</span>
            <span><Icone nom="flag" /> {nomJalon(photo.jalonId)}</span>
          </div>
          {photos.length > 1 && (
            <div className="pc-rangee" style={{ marginTop: 10 }}>
              <button className="pc-btn second petit" style={{ flex: 1 }} disabled={ouverte === 0} onClick={() => setOuverte(ouverte - 1)} aria-label="Photo précédente">
                <Icone nom="chevron-left" /> Précédente
              </button>
              <span className="pc-cote pc-muted">{ouverte + 1}/{photos.length}</span>
              <button className="pc-btn second petit" style={{ flex: 1 }} disabled={ouverte >= photos.length - 1} onClick={() => setOuverte(ouverte + 1)} aria-label="Photo suivante">
                Suivante <Icone nom="chevron-right" />
              </button>
            </div>
          )}
          <div className="pc-rangee" style={{ marginTop: 10 }}>
            <a className="pc-btn second" style={{ flex: 1 }} href={docDownloadUrl(photo)} download target="_blank" rel="noopener noreferrer">
              <Icone nom="download" /> Télécharger
            </a>
            {proprio && (
              <button className="pc-btn danger" style={{ flex: 1 }} onClick={() => setASupprimer(photo)}>
                <Icone nom="trash" /> Supprimer
              </button>
            )}
          </div>
        </Feuille>
      )}

      {/* ---------- Ajout ---------- */}
      {ajout && proprio && (
        <FeuilleAjout
          jalons={jalons}
          onFermer={fermerAjout}
          onTermine={async (n) => { setAjout(false); toast(n > 1 ? `${n} photos ajoutées ✓` : 'Photo ajoutée ✓'); await charger(); }}
          onPartiel={async () => { await charger(); }}
        />
      )}

      {aSupprimer && (
        <Confirmer
          message={`Supprimer la photo « ${aSupprimer.title} » ? Elle sera perdue.`}
          onOui={() => supprimer(aSupprimer)}
          onNon={annulerSuppression}
        />
      )}
    </>
  );
}

// ===================== Feuille : ajouter des photos =====================
// Deux entrées : « Caméra » (capture="environment" ouvre l'appareil photo arrière du
// téléphone) et « Galerie » (plusieurs fichiers d'un coup). Glisser-déposer aussi sur ordi.
// Les photos sont envoyées une par une ; en cas d'échec, celles qui restent sont
// gardées dans la liste pour réessayer (rien n'est perdu en silence).
type Choix = { cle: string; fichier: File; apercu: string };

function FeuilleAjout({ jalons, onFermer, onTermine, onPartiel }: {
  jalons: JalonLite[];
  onFermer: () => void;
  onTermine: (n: number) => void | Promise<void>;
  onPartiel: () => void | Promise<void>;
}) {
  const [choix, setChoix] = useState<Choix[]>([]);
  const [titre, setTitre] = useState('');
  const [jalonId, setJalonId] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [progres, setProgres] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);

  // Libère les aperçus (URL locales) quand la feuille se ferme.
  // (ref = toujours la liste à jour, même dans le nettoyage de fin)
  const choixRef = useRef<Choix[]>([]);
  choixRef.current = choix;
  useEffect(() => () => { choixRef.current.forEach((c) => URL.revokeObjectURL(c.apercu)); }, []);

  function ajouterFichiers(liste: FileList | null) {
    if (!liste) return;
    const refuses: string[] = [];
    const nouveaux: Choix[] = [];
    for (const f of Array.from(liste)) {
      if (!f.type.startsWith('image/')) { refuses.push(`${f.name} (pas une image)`); continue; }
      if (f.size > MAX_MO * 1024 * 1024) { refuses.push(`${f.name} (${Math.round(f.size / 1024 / 1024)} Mo, max ${MAX_MO} Mo)`); continue; }
      nouveaux.push({ cle: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`, fichier: f, apercu: URL.createObjectURL(f) });
    }
    setChoix((x) => [...x, ...nouveaux]);
    setErreur(refuses.length ? `Ignoré : ${refuses.join(', ')}.` : null);
  }
  const surFichiers = (e: ChangeEvent<HTMLInputElement>) => { ajouterFichiers(e.target.files); e.target.value = ''; };
  const surDepot = (e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); setSurvol(false); ajouterFichiers(e.dataTransfer.files); };

  function retirer(cle: string) {
    setChoix((x) => {
      const c = x.find((y) => y.cle === cle);
      if (c) URL.revokeObjectURL(c.apercu);
      return x.filter((y) => y.cle !== cle);
    });
  }

  // Titre : celui tapé (numéroté s'il y a plusieurs photos), sinon le nom du fichier.
  function titrePour(c: Choix, i: number, n: number): string {
    const t = titre.trim();
    if (t) return n > 1 ? `${t} (${i + 1})` : t;
    const base = c.fichier.name.replace(/\.[^.]+$/, '').trim();
    return base && base.toLowerCase() !== 'image' ? base : `Photo du ${dateCourte(new Date().toISOString())}`;
  }

  async function envoyer() {
    if (!choix.length) { setErreur('Prends une photo ou choisis-en dans ta galerie.'); return; }
    setOccupe(true); setErreur(null);
    const total = choix.length;
    let reussies = 0;
    const restantes: Choix[] = [];
    let derniereErreur: string | null = null;
    for (let i = 0; i < total; i++) {
      const c = choix[i];
      setProgres(`Envoi ${i + 1}/${total}…`);
      try {
        const { dataUrl, width, height } = await compressImage(c.fichier);
        await ChantierAPI.createDoc({
          kind: 'PHOTO', title: titrePour(c, i, total), fileData: dataUrl,
          mimeType: dataUrl.startsWith('data:image/webp') ? 'image/webp' : c.fichier.type,
          width, height,
          ...(jalonId ? { jalonId: Number(jalonId) } : {}),
        });
        URL.revokeObjectURL(c.apercu);
        reussies++;
      } catch (e) {
        restantes.push(c);
        derniereErreur = msg(e);
      }
    }
    setProgres(null);
    if (!restantes.length) { await onTermine(reussies); return; }
    setChoix(restantes);
    setOccupe(false);
    setErreur(`${reussies} photo${reussies > 1 ? 's' : ''} envoyée${reussies > 1 ? 's' : ''}, ${restantes.length} en échec (${derniereErreur}). Réessaie : elles sont encore ici.`);
    if (reussies) await onPartiel();
  }

  return (
    <Feuille titre="Ajouter des photos" onFermer={onFermer}>
      <div className="pc-rangee" style={{ marginBottom: 12 }}>
        <label className="pc-depose" htmlFor="pc-photo-camera" style={{ flex: 1 }}>
          <Icone nom="camera" /><br /><b>Caméra</b>
          <input id="pc-photo-camera" type="file" accept="image/*" capture="environment" onChange={surFichiers} disabled={occupe} />
        </label>
        <label
          className="pc-depose"
          htmlFor="pc-photo-galerie"
          style={{ flex: 1, borderStyle: survol ? 'solid' : undefined }}
          onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
          onDragLeave={() => setSurvol(false)}
          onDrop={surDepot}
        >
          <Icone nom="images" /><br /><b>Galerie</b>
          <input id="pc-photo-galerie" type="file" accept="image/*" multiple onChange={surFichiers} disabled={occupe} />
        </label>
      </div>
      <p className="pc-muted pc-petit" style={{ marginTop: -4 }}>Plusieurs photos d'un coup possible · max {MAX_MO} Mo chacune · compressées avant l'envoi.</p>

      {choix.length > 0 && (
        <div className="pc-grille-photos" style={{ marginBottom: 12 }}>
          {choix.map((c) => (
            <button key={c.cle} onClick={() => retirer(c.cle)} disabled={occupe} aria-label={`Retirer ${c.fichier.name}`} style={{ position: 'relative' }}>
              <img src={c.apercu} alt="" />
              <span className="pc-chip pc-c-neutre" style={{ position: 'absolute', top: 4, right: 4 }}><Icone nom="xmark" /></span>
            </button>
          ))}
        </div>
      )}

      <Champ id="pc-photo-titre" label={choix.length > 1 ? 'Titre (optionnel, numéroté pour chaque photo)' : 'Titre (optionnel)'}>
        <input id="pc-photo-titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Coffrage des fondations" />
      </Champ>
      <Champ id="pc-photo-jalon" label="Rattacher à un jalon (optionnel)">
        <select id="pc-photo-jalon" value={jalonId} onChange={(e) => setJalonId(e.target.value)}>
          <option value="">— Aucun —</option>
          {jalons.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
      </Champ>

      <Erreur message={erreur} />
      <div style={{ marginTop: erreur ? 10 : 0 }}>
        <button className="pc-btn" disabled={occupe || !choix.length} onClick={envoyer}>
          {progres || (choix.length > 1 ? `Ajouter ${choix.length} photos` : 'Ajouter la photo')}
        </button>
      </div>
    </Feuille>
  );
}
