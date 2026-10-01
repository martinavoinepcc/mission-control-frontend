'use client';

// =====================================================================
// JALONS — écrans 'jalons' (liste) et 'jalon' (fiche, #jalon/<id>)
// Tuile requise : « jalons ».
// ---------------------------------------------------------------------
// Porté de l'ancienne app Chantier : JalonsView + JalonGroup, GrilleBanque
// (avancement officiel de la banque), JalonDetailModal (devenu l'écran fiche),
// JalonFormModal, DepenseFormModal et PhotoFormModal (version « document du jalon »).
// NOUVEAU : modifier et supprimer un jalon (l'API le permettait, l'écran non).
//
// Routes API appelées (via lib/chantier-api.ts) :
//   GET    /chantier/jalons                 liste (Pré-construction / Construction)
//   POST   /chantier/jalons                 ajouter (proprio)
//   GET    /chantier/jalons/:id             fiche : soumissions + dépenses + documents
//                                           (pour un invité, le backend vide les soumissions
//                                            sans tuile « soumissions » et les dépenses sans
//                                            tuile « budget » → on masque ces sections)
//   PATCH  /chantier/jalons/:id             modifier / changer le statut (proprio)
//                                           (passer COMPLETE met progress 100 + date du jour, backend)
//   DELETE /chantier/jalons/:id             supprimer (proprio, après Confirmer) ; les soumissions,
//                                           dépenses et documents rattachés sont gardés mais détachés
//   GET    /chantier/avancement             grille banque (postes par stade, % global)
//   PATCH  /chantier/avancement/:id         stepper 0/25/50/75/100 (proprio)
//   PATCH  /chantier/soumissions/:id        accepter / refuser depuis la fiche (proprio)
//   POST   /chantier/soumissions            ajouter une soumission au jalon (proprio)
//   POST   /chantier/depenses               ajouter un déboursé au jalon (proprio)
//   POST   /chantier/docs                   ajouter un document / photo au jalon (proprio)
//   GET    /chantier/docs/:id/raw           ouvrir / télécharger un document
//   GET    /chantier/trades                 liste des corps de métier (formulaires, proprio)
// =====================================================================

import { useCallback, useEffect, useState, type DragEvent } from 'react';
import {
  ChantierAPI, compressImage, docFileUrl, docDownloadUrl, fmtSize,
  type JalonLite, type JalonDetail, type JalonStatus, type ChantierPhase, type AvancementItem,
  type Trade, type DocKind, type DepenseType, type SoumissionStatus, type Doc,
} from '@/lib/chantier-api';
import {
  useChalet, Entete, Icone, Chip, Vide, Erreur, Chargement, Feuille, Confirmer, Champ,
  argent, dateCourte, type EcranProps,
} from '../_kit/ui';
import { CarteSoumission, FeuilleSoumission, meilleurPrix, msgErreur, versMontant } from './Soumissions';

type V = 'ok' | 'warn' | 'bad' | 'info' | 'neutre';

export const JALON_STATUT: Record<JalonStatus, { libelle: string; v: V; icone: string }> = {
  A_VENIR: { libelle: 'À venir', v: 'neutre', icone: 'flag' },
  EN_COURS: { libelle: 'En cours', v: 'info', icone: 'person-digging' },
  COMPLETE: { libelle: 'Complété', v: 'ok', icone: 'check' },
  EN_RETARD: { libelle: 'En retard', v: 'bad', icone: 'clock' },
  BLOQUE: { libelle: 'Bloqué', v: 'warn', icone: 'ban' },
};
const ORDRE_STATUTS: JalonStatus[] = ['A_VENIR', 'EN_COURS', 'COMPLETE', 'EN_RETARD', 'BLOQUE'];

const PHASES: Array<{ cle: ChantierPhase; libelle: string }> = [
  { cle: 'PRE_CONSTRUCTION', libelle: 'Pré-construction' },
  { cle: 'CONSTRUCTION', libelle: 'Construction' },
];

const DOC_TYPES: Array<{ cle: DocKind; libelle: string; icone: string }> = [
  { cle: 'PLAN', libelle: 'Plan', icone: 'compass-drafting' },
  { cle: 'PERMIS', libelle: 'Permis', icone: 'stamp' },
  { cle: 'CONTRAT', libelle: 'Contrat', icone: 'file-signature' },
  { cle: 'PHOTO', libelle: 'Photo', icone: 'camera' },
  { cle: 'RECU', libelle: 'Reçu', icone: 'receipt' },
  { cle: 'AUTRE', libelle: 'Autre', icone: 'file-lines' },
];

const DEPENSE_TYPES: Array<{ cle: DepenseType; libelle: string }> = [
  { cle: 'DEPOT', libelle: 'Dépôt' },
  { cle: 'PARTIEL', libelle: 'Paiement partiel' },
  { cle: 'FINAL', libelle: 'Paiement final' },
  { cle: 'EXTRA', libelle: 'Extra' },
];

// Grille d'inspection progressive de la banque.
const STADES: Record<number, string> = {
  1: 'Stade 1 — Fondation et charpente',
  2: 'Stade 2 — Systèmes et recouvrements',
  3: 'Stade 3 — Finition',
};
const PAS_PCT = [0, 25, 50, 75, 100];

const MAX_FICHIER_MO = 40;

// « 2026-08-25T00:00:00.000Z » → « 2026-08-25 » pour un <input type="date">.
function versInputDate(d: string | null | undefined): string {
  return d ? d.slice(0, 10) : '';
}

// =====================================================================
// Avancement officiel banque (section de l'écran Jalons)
// =====================================================================
function AvancementBanque() {
  const { proprio, toast, recharger } = useChalet();
  const [items, setItems] = useState<AvancementItem[]>([]);
  const [global, setGlobal] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [stadeOuvert, setStadeOuvert] = useState<number | null>(null);
  const [occupe, setOccupe] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const r = await ChantierAPI.avancement();
      setItems(r.items);
      setGlobal(r.global);
    } catch {
      // Section facultative : si la grille ne charge pas, on ne l'affiche simplement pas.
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function choisirPct(it: AvancementItem, pct: number) {
    if (it.pct === pct) return;
    setOccupe(it.id);
    setErreur(null);
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, pct } : x))); // affichage immédiat
    try {
      await ChantierAPI.updateAvancement(it.id, pct);
      toast(`${it.name} : ${pct} %`);
      recharger(); // la bande d'avancement de l'accueil suit
    } catch (e) {
      setErreur(msgErreur(e));
    } finally {
      await charger();
      setOccupe(null);
    }
  }

  if (!items.length) return null;
  const stades = [...new Set(items.map((i) => i.stade))].sort((a, b) => a - b);

  return (
    <section className="pc-carte" style={{ padding: 14 }}>
      <div className="pc-rangee" style={{ justifyContent: 'space-between' }}>
        <span className="pc-surtitre"><Icone nom="building-columns" /> Avancement officiel banque</span>
        <b className="pc-cote" style={{ fontSize: 18, color: 'var(--pc-sapin)' }}>{global} %</b>
      </div>
      <div className="pc-barre" style={{ marginTop: 8 }} role="img" aria-label={`Avancement banque ${global} %`}>
        <i style={{ width: `${Math.min(100, global)}%` }} />
      </div>
      <button className="pc-lien" style={{ marginTop: 10 }} onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <Icone nom={ouvert ? 'chevron-up' : 'chevron-down'} /> {ouvert ? 'Masquer la grille' : `Voir la grille (${items.length} postes)`}
      </button>
      <Erreur message={erreur} />

      {ouvert && stades.map((s) => {
        const postes = items.filter((i) => i.stade === s);
        const poids = postes.reduce((a, i) => a + i.weight, 0);
        const fait = postes.reduce((a, i) => a + (i.weight * i.pct) / 100, 0);
        const pctStade = poids ? Math.round((fait / poids) * 100) : 0;
        const estOuvert = stadeOuvert === s;
        return (
          <div key={s} style={{ marginTop: 10 }}>
            <button
              className="pc-ligne"
              style={{ border: '1px solid var(--pc-ligne)', borderRadius: 12 }}
              onClick={() => setStadeOuvert(estOuvert ? null : s)}
              aria-expanded={estOuvert}
            >
              <span className="pc-txt">
                <b>{STADES[s] || `Stade ${s}`}</b>
                <small>{pctStade} % · pèse {Math.round(poids * 10) / 10} % du total</small>
              </span>
              <Icone nom={estOuvert ? 'chevron-up' : 'chevron-down'} className="pc-muted" />
            </button>
            {estOuvert && postes.map((it) => (
              <div key={it.id} style={{ padding: '10px 2px', borderBottom: '1px solid var(--pc-ligne)' }}>
                <div className="pc-rangee" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 13.5, minWidth: 0, overflowWrap: 'anywhere' }}>{it.name}</span>
                  <span className="pc-petit pc-muted pc-cote" style={{ flex: '0 0 auto' }}>
                    {proprio ? `${it.weight} %` : `${it.pct} % · pèse ${it.weight} %`}
                  </span>
                </div>
                {proprio && (
                  <div className="pc-segment" role="group" aria-label={`Avancement de ${it.name}`} style={{ marginBottom: 0 }}>
                    {PAS_PCT.map((p) => (
                      <button
                        key={p}
                        className={it.pct === p ? 'on' : ''}
                        aria-pressed={it.pct === p}
                        aria-label={`${it.name} : ${p} %`}
                        disabled={occupe === it.id}
                        onClick={() => choisirPct(it, p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}

// =====================================================================
// Formulaire jalon : ajouter (jalon = null) ou modifier (proprio)
// =====================================================================
function FeuilleJalon({ jalon, onFermer, onEnregistre }: {
  jalon: JalonLite | null;
  onFermer: () => void;
  onEnregistre: (j: JalonLite) => void | Promise<void>;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [nom, setNom] = useState(jalon?.name || '');
  const [phase, setPhase] = useState<ChantierPhase>(jalon?.phase || 'CONSTRUCTION');
  const [tradeId, setTradeId] = useState(jalon?.tradeId ? String(jalon.tradeId) : '');
  const [echeance, setEcheance] = useState(versInputDate(jalon?.dueDate));
  const [description, setDescription] = useState(jalon?.description || '');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => { ChantierAPI.trades().then((r) => setTrades(r.trades)).catch(() => {}); }, []);

  async function enregistrer() {
    if (!nom.trim()) { setErreur('Le nom du jalon est requis.'); return; }
    setOccupe(true);
    setErreur(null);
    const corps: Partial<JalonLite> = {
      name: nom.trim(),
      phase,
      description: description.trim() || null,
      dueDate: echeance || null,
      tradeId: tradeId ? Number(tradeId) : null,
    };
    try {
      const r = jalon ? await ChantierAPI.updateJalon(jalon.id, corps) : await ChantierAPI.createJalon(corps);
      await onEnregistre(r.jalon);
    } catch (e) {
      setErreur(msgErreur(e));
      setOccupe(false);
    }
  }

  return (
    <Feuille titre={jalon ? 'Modifier le jalon' : 'Nouveau jalon'} onFermer={onFermer}>
      <Champ id="fj-nom" label="Nom du jalon">
        <input id="fj-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Coulée de la fondation" />
      </Champ>
      <Champ id="fj-phase" label="Phase">
        <select id="fj-phase" value={phase} onChange={(e) => setPhase(e.target.value as ChantierPhase)}>
          {PHASES.map((p) => <option key={p.cle} value={p.cle}>{p.libelle}</option>)}
        </select>
      </Champ>
      <Champ id="fj-trade" label="Corps de métier (optionnel)">
        <select id="fj-trade" value={tradeId} onChange={(e) => setTradeId(e.target.value)}>
          <option value="">— Aucun —</option>
          {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Champ>
      <Champ id="fj-echeance" label="Échéance (optionnel)">
        <input id="fj-echeance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
      </Champ>
      <Champ id="fj-desc" label="Description (optionnel)">
        <textarea id="fj-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Champ>
      <Erreur message={erreur} />
      <button className="pc-btn" style={{ marginTop: 10 }} disabled={occupe} onClick={enregistrer}>
        {occupe ? 'Enregistrement…' : jalon ? 'Enregistrer' : 'Ajouter le jalon'}
      </button>
    </Feuille>
  );
}

// =====================================================================
// Écran 'jalons' : liste groupée par phase + avancement banque
// =====================================================================
export function Jalons(_: EcranProps) {
  const { aller, toast, proprio } = useChalet();
  const [jalons, setJalons] = useState<JalonLite[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);

  const charger = useCallback(async () => {
    try {
      setJalons((await ChantierAPI.jalons()).jalons);
      setErreur(null);
    } catch (e) {
      setErreur(msgErreur(e));
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);
  const fermerAjout = useCallback(() => setAjout(false), []);

  return (
    <>
      <Entete
        titre="Jalons"
        actions={proprio ? (
          <button className="pc-icobtn" onClick={() => setAjout(true)} aria-label="Ajouter un jalon">
            <Icone nom="plus" />
          </button>
        ) : undefined}
      />

      <AvancementBanque />
      <Erreur message={erreur} />
      {!jalons && !erreur && <Chargement />}

      {jalons && PHASES.map((ph) => {
        const liste = jalons.filter((j) => j.phase === ph.cle);
        return (
          <section key={ph.cle}>
            <div className="pc-section-titre">
              <h3>{ph.libelle}</h3>
              <span className="pc-petit pc-muted">
                {liste.filter((j) => j.status === 'COMPLETE').length}/{liste.length} complétés
              </span>
            </div>
            {liste.length === 0 ? (
              <div className="pc-liste"><Vide>Aucun jalon.</Vide></div>
            ) : (
              <div className="pc-liste">
                {liste.map((j) => {
                  const st = JALON_STATUT[j.status] || JALON_STATUT.A_VENIR;
                  const infos = [
                    j.status === 'COMPLETE' && j.doneDate ? `fait ${dateCourte(j.doneDate)}` : j.dueDate ? `échéance ${dateCourte(j.dueDate)}` : 'date à confirmer',
                    j.trade?.name,
                    j._count && j._count.soumissions > 0 ? `${j._count.soumissions} soum.` : null,
                    j._count && j._count.docs > 0 ? `${j._count.docs} doc.` : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <button key={j.id} className="pc-ligne" onClick={() => aller('jalon', j.id)}>
                      <span className={`pc-pt pc-c-${st.v}`}><Icone nom={st.icone} /></span>
                      <span className="pc-txt"><b>{j.name}</b><small>{infos}</small></span>
                      <Chip v={st.v}>{st.libelle}</Chip>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {proprio && ajout && (
        <FeuilleJalon
          jalon={null}
          onFermer={fermerAjout}
          onEnregistre={async (j) => { setAjout(false); toast('Jalon ajouté'); await charger(); aller('jalon', j.id); }}
        />
      )}
    </>
  );
}

// =====================================================================
// Formulaire : déboursé rattaché au jalon (proprio)
// =====================================================================
function FeuilleDepense({ jalonId, tradeIdDefaut, onFermer, onEnregistre }: {
  jalonId: number;
  tradeIdDefaut: number | null;
  onFermer: () => void;
  onEnregistre: () => void | Promise<void>;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [type, setType] = useState<DepenseType>('PARTIEL');
  const [tradeId, setTradeId] = useState(tradeIdDefaut ? String(tradeIdDefaut) : '');
  const [payeLe, setPayeLe] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => { ChantierAPI.trades().then((r) => setTrades(r.trades)).catch(() => {}); }, []);

  async function enregistrer() {
    const amount = versMontant(montant);
    if (amount === null || amount === 0) { setErreur('Entre un montant valide (ex. 2500).'); return; }
    setOccupe(true);
    setErreur(null);
    try {
      await ChantierAPI.createDepense({
        label: libelle.trim() || null,
        amount,
        type,
        jalonId,
        tradeId: tradeId ? Number(tradeId) : null,
        paidAt: payeLe || null,
      });
      await onEnregistre();
    } catch (e) {
      setErreur(msgErreur(e));
      setOccupe(false);
    }
  }

  return (
    <Feuille titre="Ajouter un déboursé" onFermer={onFermer}>
      <Champ id="fd-libelle" label="Description">
        <input id="fd-libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="ex. Dépôt excavation" />
      </Champ>
      <Champ id="fd-montant" label="Montant ($)">
        <input id="fd-montant" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
      </Champ>
      <Champ id="fd-type" label="Type">
        <select id="fd-type" value={type} onChange={(e) => setType(e.target.value as DepenseType)}>
          {DEPENSE_TYPES.map((t) => <option key={t.cle} value={t.cle}>{t.libelle}</option>)}
        </select>
      </Champ>
      <Champ id="fd-trade" label="Corps de métier (optionnel)">
        <select id="fd-trade" value={tradeId} onChange={(e) => setTradeId(e.target.value)}>
          <option value="">— Aucun —</option>
          {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Champ>
      <Champ id="fd-date" label="Payé le (optionnel)">
        <input id="fd-date" type="date" value={payeLe} onChange={(e) => setPayeLe(e.target.value)} />
      </Champ>
      <Erreur message={erreur} />
      <button className="pc-btn" style={{ marginTop: 10 }} disabled={occupe} onClick={enregistrer}>
        {occupe ? 'Enregistrement…' : 'Ajouter'}
      </button>
    </Feuille>
  );
}

// =====================================================================
// Formulaire : document / photo rattaché au jalon (proprio)
// Images compressées en webp côté client (compressImage) ; PDF et autres envoyés tels quels.
// =====================================================================
function FeuilleDoc({ jalonId, onFermer, onEnregistre }: {
  jalonId: number;
  onFermer: () => void;
  onEnregistre: () => void | Promise<void>;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [type, setType] = useState<DocKind>('AUTRE');
  const [survol, setSurvol] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function prendre(f: File) {
    setErreur(null);
    if (f.size > MAX_FICHIER_MO * 1024 * 1024) {
      setErreur(`Fichier trop gros (${Math.round(f.size / 1024 / 1024)} Mo). Maximum : ${MAX_FICHIER_MO} Mo.`);
      return;
    }
    setFichier(f);
    if (!titre) setTitre(f.name.replace(/\.[^.]+$/, ''));
    if (f.type.startsWith('image/')) {
      if (type === 'AUTRE') setType('PHOTO');
      try { setApercu((await compressImage(f)).dataUrl); } catch { setApercu(null); }
    } else {
      if (f.type === 'application/pdf' && type === 'AUTRE') setType('PLAN');
      setApercu(null);
    }
  }

  function surDepot(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setSurvol(false);
    const f = e.dataTransfer.files?.[0];
    if (f) prendre(f);
  }

  async function enregistrer() {
    if (!fichier) { setErreur('Choisis un fichier ou prends une photo.'); return; }
    if (!titre.trim()) { setErreur('Donne un titre.'); return; }
    setOccupe(true);
    setErreur(null);
    try {
      let fileData: string;
      let mimeType = fichier.type || 'application/octet-stream';
      let width: number | undefined;
      let height: number | undefined;
      if (fichier.type.startsWith('image/')) {
        const c = await compressImage(fichier);
        fileData = c.dataUrl; width = c.width; height = c.height; mimeType = 'image/webp';
      } else {
        fileData = await new Promise<string>((ok, ko) => {
          const r = new FileReader();
          r.onload = () => ok(String(r.result));
          r.onerror = () => ko(new Error('Lecture du fichier impossible.'));
          r.readAsDataURL(fichier);
        });
      }
      await ChantierAPI.createDoc({
        kind: type, title: titre.trim(), fileData, mimeType, width, height, jalonId,
        fileName: fichier.name, fileSize: fichier.size,
      });
      await onEnregistre();
    } catch (e) {
      setErreur(msgErreur(e));
      setOccupe(false);
    }
  }

  return (
    <Feuille titre="Ajouter un document" onFermer={onFermer}>
      <label
        className="pc-depose"
        htmlFor="fdoc-fichier"
        onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={surDepot}
        style={survol ? { borderStyle: 'solid' } : undefined}
      >
        <Icone nom="cloud-arrow-up" /><br />
        <b>{fichier ? fichier.name : 'Choisir un fichier'}</b><br />
        <small>{fichier ? fmtSize(fichier.size) : `Plan PDF, facture, photo… (max ${MAX_FICHIER_MO} Mo)`}</small>
        <input id="fdoc-fichier" type="file" accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) prendre(f); }} />
      </label>
      <label className="pc-btn second" htmlFor="fdoc-camera" style={{ marginTop: 8 }}>
        <Icone nom="camera" /> Prendre une photo
        <input id="fdoc-camera" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) prendre(f); }} />
      </label>
      {apercu && <img src={apercu} alt="Aperçu du fichier choisi" style={{ marginTop: 10, borderRadius: 12, maxHeight: 200, width: '100%', objectFit: 'cover' }} />}
      <div style={{ marginTop: 12 }}>
        <Champ id="fdoc-titre" label="Titre">
          <input id="fdoc-titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
        </Champ>
        <Champ id="fdoc-type" label="Type">
          <select id="fdoc-type" value={type} onChange={(e) => setType(e.target.value as DocKind)}>
            {DOC_TYPES.map((k) => <option key={k.cle} value={k.cle}>{k.libelle}</option>)}
          </select>
        </Champ>
      </div>
      <Erreur message={erreur} />
      <button className="pc-btn" style={{ marginTop: 10 }} disabled={occupe} onClick={enregistrer}>
        {occupe ? 'Téléversement…' : 'Ajouter'}
      </button>
    </Feuille>
  );
}

// =====================================================================
// Écran 'jalon' : fiche d'un jalon (#jalon/<id>)
// =====================================================================
type SousFeuille = null | 'modifier' | 'supprimer' | 'soumission' | 'depense' | 'doc';

export function JalonFiche({ params }: EcranProps) {
  const { aller, toast, proprio, peutVoir } = useChalet();
  const id = Number(params[0]);
  const [jalon, setJalon] = useState<JalonDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [feuille, setFeuille] = useState<SousFeuille>(null);

  const charger = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) { setErreur('Jalon introuvable.'); return; }
    try {
      setJalon((await ChantierAPI.jalon(id)).jalon);
      setErreur(null);
    } catch (e) {
      setErreur(msgErreur(e));
    }
  }, [id]);
  useEffect(() => { charger(); }, [charger]);
  const fermer = useCallback(() => setFeuille(null), []);

  // Un invité sans la tuile ne reçoit rien (backend) : on n'affiche pas la section du tout.
  const voitSoumissions = proprio || peutVoir('soumissions');
  const voitDepenses = proprio || peutVoir('budget');

  async function changerStatut(status: JalonStatus) {
    if (!jalon || jalon.status === status) return;
    setOccupe(true);
    try {
      await ChantierAPI.updateJalon(jalon.id, { status });
      toast(`Statut : ${JALON_STATUT[status].libelle}`);
      await charger();
    } catch (e) {
      setErreur(msgErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  async function statutSoumission(sid: number, status: SoumissionStatus) {
    setOccupe(true);
    try {
      await ChantierAPI.updateSoumission(sid, { status });
      toast(status === 'ACCEPTEE' ? 'Soumission acceptée — les autres du jalon sont refusées' : 'Soumission refusée');
      await charger();
    } catch (e) {
      setErreur(msgErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  if (!jalon) {
    return (
      <>
        <Entete titre="Jalon" />
        {erreur ? <Erreur message={erreur} /> : <Chargement />}
      </>
    );
  }

  const st = JALON_STATUT[jalon.status] || JALON_STATUT.A_VENIR;
  const phase = PHASES.find((p) => p.cle === jalon.phase)?.libelle || '';
  const min = meilleurPrix(jalon.soumissions);
  const totalDepenses = jalon.depenses.reduce((a, d) => a + d.amount, 0);
  const typeDoc = (d: Doc) => DOC_TYPES.find((k) => k.cle === d.kind) || DOC_TYPES[DOC_TYPES.length - 1];

  return (
    <>
      <Entete
        titre={jalon.name}
        actions={proprio ? (
          <>
            <button className="pc-icobtn" onClick={() => setFeuille('modifier')} aria-label="Modifier le jalon"><Icone nom="pen" /></button>
            <button className="pc-icobtn" onClick={() => setFeuille('supprimer')} aria-label="Supprimer le jalon"><Icone nom="trash" /></button>
          </>
        ) : undefined}
      />
      <Erreur message={erreur} />

      {/* Infos */}
      <div className="pc-carte" style={{ padding: 14 }}>
        <div className="pc-rangee" style={{ justifyContent: 'space-between' }}>
          <span className="pc-surtitre">{[phase, jalon.trade?.name].filter(Boolean).join(' · ')}</span>
          <Chip v={st.v}>{st.libelle}</Chip>
        </div>
        {jalon.description && <p style={{ margin: '8px 0 0', overflowWrap: 'anywhere' }}>{jalon.description}</p>}
        <div className="pc-meta">
          <span>Échéance : <span className="pc-cote">{dateCourte(jalon.dueDate)}</span></span>
          {jalon.doneDate && <span>Complété le : <span className="pc-cote">{dateCourte(jalon.doneDate)}</span></span>}
        </div>
      </div>

      {/* Statut (proprio) */}
      {proprio && (
        <>
          <div className="pc-section-titre"><h3>Statut</h3></div>
          <div className="pc-rangee" role="group" aria-label="Changer le statut du jalon">
            {ORDRE_STATUTS.map((s) => (
              <button
                key={s}
                className={`pc-btn petit ${jalon.status === s ? '' : 'second'}`}
                aria-pressed={jalon.status === s}
                disabled={occupe}
                onClick={() => changerStatut(s)}
              >
                {JALON_STATUT[s].libelle}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Soumissions */}
      {voitSoumissions && (
        <section>
          <div className="pc-section-titre">
            <h3>Soumissions <span className="pc-petit pc-muted">· {jalon.soumissions.filter((s) => s.status !== 'REFUSEE').length}/3 prix</span></h3>
            {proprio && <button className="pc-lien" onClick={() => setFeuille('soumission')}><Icone nom="plus" /> Ajouter</button>}
          </div>
          {jalon.soumissions.length === 0 ? (
            <div className="pc-liste"><Vide>Aucune soumission.</Vide></div>
          ) : jalon.soumissions.map((s) => (
            <CarteSoumission
              key={s.id}
              s={s}
              meilleur={min !== null && s.amount === min && s.status !== 'REFUSEE'}
              sousTitre={[s.contact?.person, s.contact?.phone, s.contact?.company ? s.label : null].filter(Boolean).join(' · ')}
              proprio={proprio}
              occupe={occupe}
              onAccepter={() => statutSoumission(s.id, 'ACCEPTEE')}
              onRefuser={() => statutSoumission(s.id, 'REFUSEE')}
            />
          ))}
        </section>
      )}

      {/* Dépenses */}
      {voitDepenses && (
        <section>
          <div className="pc-section-titre">
            <h3>Déboursés {jalon.depenses.length > 0 && <span className="pc-petit pc-muted pc-cote">· {argent(totalDepenses)}</span>}</h3>
            {proprio && <button className="pc-lien" onClick={() => setFeuille('depense')}><Icone nom="plus" /> Ajouter</button>}
          </div>
          <div className="pc-liste">
            {jalon.depenses.length === 0 ? <Vide>Aucun déboursé.</Vide> : jalon.depenses.map((d) => (
              <div key={d.id} className="pc-ligne">
                <span className="pc-txt">
                  <b>{d.label || DEPENSE_TYPES.find((t) => t.cle === d.type)?.libelle || 'Déboursé'}</b>
                  <small>{[DEPENSE_TYPES.find((t) => t.cle === d.type)?.libelle, d.paidAt ? dateCourte(d.paidAt) : null].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="pc-cote" style={{ fontWeight: 700 }}>{argent(d.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Documents */}
      <section>
        <div className="pc-section-titre">
          <h3>Plans &amp; documents</h3>
          {proprio && <button className="pc-lien" onClick={() => setFeuille('doc')}><Icone nom="plus" /> Ajouter</button>}
        </div>
        <div className="pc-liste">
          {jalon.docs.length === 0 ? <Vide>Aucun document.</Vide> : jalon.docs.map((d) => (
            <div key={d.id} className="pc-ligne">
              <span className="pc-pt pc-c-info"><Icone nom={typeDoc(d).icone} /></span>
              <span className="pc-txt"><b>{d.title}</b><small>{typeDoc(d).libelle} · {dateCourte(d.createdAt)}</small></span>
              <a className="pc-icobtn" href={docFileUrl(d)} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${d.title}`}>
                <Icone nom="up-right-from-square" />
              </a>
              <a className="pc-icobtn" href={docDownloadUrl(d)} download aria-label={`Télécharger ${d.title}`}>
                <Icone nom="download" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Feuilles (proprio seulement) */}
      {proprio && feuille === 'modifier' && (
        <FeuilleJalon
          jalon={jalon}
          onFermer={fermer}
          onEnregistre={async () => { setFeuille(null); toast('Jalon modifié'); await charger(); }}
        />
      )}
      {proprio && feuille === 'supprimer' && (
        <Confirmer
          message={`Supprimer le jalon « ${jalon.name} » ? Ses soumissions, déboursés et documents sont conservés mais ne seront plus rattachés à un jalon.`}
          onNon={fermer}
          onOui={async () => {
            try {
              await ChantierAPI.deleteJalon(jalon.id);
              setFeuille(null);
              toast('Jalon supprimé');
              aller('jalons');
            } catch (e) {
              setFeuille(null);
              setErreur(msgErreur(e));
            }
          }}
        />
      )}
      {proprio && feuille === 'soumission' && (
        <FeuilleSoumission
          jalonFixe={jalon.id}
          onFermer={fermer}
          onEnregistre={async () => { setFeuille(null); toast('Soumission ajoutée'); await charger(); }}
        />
      )}
      {proprio && feuille === 'depense' && (
        <FeuilleDepense
          jalonId={jalon.id}
          tradeIdDefaut={jalon.tradeId}
          onFermer={fermer}
          onEnregistre={async () => { setFeuille(null); toast('Déboursé ajouté'); await charger(); }}
        />
      )}
      {proprio && feuille === 'doc' && (
        <FeuilleDoc
          jalonId={jalon.id}
          onFermer={fermer}
          onEnregistre={async () => { setFeuille(null); toast('Document ajouté'); await charger(); }}
        />
      )}
    </>
  );
}
