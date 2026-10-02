'use client';

// =====================================================================
// PROJET CHALET — Plans & devis (4 écrans), 2026-10-01
// ---------------------------------------------------------------------
// Port de l'onglet « Plans & devis » de l'ancienne app Chantier
// (app/apps/chantier/page.tsx : PlansView, SerieFormModal, VersionFormModal,
// ClasserDocModal). Rien n'est perdu : chaque fonction existe ici.
//
// Vocabulaire : une « série » (PlanSerie) = un document (ex. « Plans TALO »),
// qui garde TOUTES ses versions (Doc avec serieId). La version courante est la
// plus récente : tri versionDate desc (vide en dernier) puis createdAt desc,
// calculé ici côté client (on ne se fie pas à l'ordre reçu).
//
// Écrans (adresse → composant) :
//  #plans                    → PlansCategories
//      Tuiles des catégories (nb documents · nb versions). Catégorie sans série
//      masquée, catégorie sans version grisée. Proprio : « Nouveau document »
//      (= créer une série) et « N documents à classer » (anciens fichiers sans
//      série, à ranger dans une série).
//      API : GET /chantier/plans, GET /projet-chalet/plans/categories,
//            POST /chantier/plans/series, PATCH /chantier/docs/:id (classer)
//  #planCat/<clé>            → PlanCategorie
//      Les séries d'une catégorie avec leur version courante et sa date.
//      API : GET /chantier/plans, GET /projet-chalet/plans/categories,
//            POST /chantier/plans/series (proprio)
//  #serie/<serieId>          → Serie
//      Grande carte « version courante » : un toucher ouvre le plan dans le
//      lecteur du téléphone. Anciennes versions en liste (un toucher = ouvrir).
//      Menu « ⋯ » : télécharger, comparer, partager (proprio), supprimer (proprio).
//      « ⋯ » de l'en-tête (proprio) : ajouter une version, renommer, supprimer si vide.
//      API : GET /chantier/plans, GET /projet-chalet/plans/categories,
//            POST /chantier/docs, DELETE /chantier/docs/:id,
//            PATCH|DELETE /chantier/plans/series/:id, POST /projet-chalet/partages
//  #lecteur/<serieId>/<docId> → Lecteur
//      Mode lecture d'une version (image, PDF ou lien externe), pastilles pour
//      passer d'une version à l'autre, bandeau si ancienne version.
//      API : GET /chantier/plans, GET /chantier/docs/:id/raw (fichier),
//            POST /projet-chalet/partages (proprio)
//
// Invité (proprio = false) : lecture seule, aucun bouton d'écriture.
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ChantierAPI, docDownloadUrl, docFileUrl, fmtSize, compressImage,
  type Doc, type DocKind, type PlanCategorie as CleCategorie, type PlanSerie, type PlansPayload,
} from '@/lib/chantier-api';
import { ProjetChaletAPI, type CategoriePlan } from '@/lib/projet-chalet-api';
import {
  Icone, Entete, Chip, Vide, Erreur, Chargement, Feuille, Confirmer, Champ, dateCourte, useChalet,
  type EcranProps,
} from '../_kit/ui';

// ---------- Outils ----------

const MAX_MO = 40; // taille max d'un fichier téléversé (comme l'ancienne app)

function messageErreur(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Erreur inattendue.';
}

// Date affichée d'une version : date d'émission, sinon date d'ajout.
function dateVersion(d: Doc): string {
  return dateCourte(d.versionDate || d.createdAt);
}

function temps(s: string | null | undefined): number {
  if (!s) return Number.NEGATIVE_INFINITY;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

// Tri des versions : la plus récente d'abord (versionDate desc, vide en dernier, puis createdAt desc).
function trierVersions(docs: Doc[]): Doc[] {
  return [...docs].sort((a, b) => {
    const va = temps(a.versionDate);
    const vb = temps(b.versionDate);
    if (va !== vb) return vb - va; // -Infinity (vide) tombe en dernier
    return temps(b.createdAt) - temps(a.createdAt);
  });
}

// Étiquette courte d'une version (« v4 », sinon « #3 » selon sa place dans l'historique).
function etiquette(d: Doc, triees: Doc[]): string {
  if (d.version) return d.version;
  const i = triees.findIndex((x) => x.id === d.id);
  return `#${triees.length - i}`;
}

// Lien externe (Drive, site...) plutôt qu'un fichier : même règle que l'ancienne app.
function estLien(d: Doc): boolean {
  return !!d.fileUrl && !/\.(pdf|jpe?g|png|webp|gif|skp|glb|dwg)(\?|$)/i.test(d.fileUrl);
}

type Genre = 'image' | 'pdf' | 'lien' | 'autre';
function genre(d: Doc): Genre {
  const mime = d.mimeType || '';
  const nom = d.fileName || d.fileUrl || '';
  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(nom)) return 'image';
  if (mime === 'application/pdf' || /\.pdf(\?|$)/i.test(nom)) return 'pdf';
  if (estLien(d)) return 'lien';
  return 'autre';
}

function lireDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    r.readAsDataURL(file);
  });
}

// Libellé + icône d'une catégorie (viennent de l'API ; clé inconnue → la clé elle-même).
function infoCategorie(cats: CategoriePlan[], cle: string): CategoriePlan {
  return cats.find((c) => c.cle === cle) || { cle, nom: cle, icone: 'folder' };
}

// Liste des catégories à proposer / afficher : celles de l'API, plus toute catégorie
// présente dans les séries mais absente de l'API (pour ne jamais cacher un document).
function toutesCategories(cats: CategoriePlan[], series: PlanSerie[]): CategoriePlan[] {
  const liste = [...cats];
  for (const s of series) {
    if (!liste.some((c) => c.cle === s.category)) liste.push(infoCategorie(cats, s.category));
  }
  return liste;
}

// ---------- Chargement commun (plans + catégories) ----------

type Donnees = { plans: PlansPayload; cats: CategoriePlan[] };

function usePlans() {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const recharger = useCallback(async () => {
    try {
      const [plans, cats] = await Promise.all([
        ChantierAPI.plans(),
        // Les libellés sont un plus : si l'appel échoue, on affiche les clés brutes.
        ProjetChaletAPI.categoriesPlans().then((r) => r.categories).catch(() => [] as CategoriePlan[]),
      ]);
      setDonnees({ plans, cats });
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, []);
  useEffect(() => { recharger(); }, [recharger]);
  return { donnees, erreur, recharger };
}

// =====================================================================
// 1. PlansCategories — #plans
// =====================================================================
export function PlansCategories(_props: EcranProps) {
  const { aller, toast, proprio } = useChalet();
  const { donnees, erreur, recharger } = usePlans();
  const [feuille, setFeuille] = useState<null | 'serie' | 'classer'>(null);
  const fermer = useCallback(() => setFeuille(null), []);

  if (erreur && !donnees) return (<><Entete titre="Plans & devis" /><Erreur message={erreur} /></>);
  if (!donnees) return (<><Entete titre="Plans & devis" /><Chargement /></>);

  const { plans, cats } = donnees;
  const tuiles = toutesCategories(cats, plans.series)
    .map((c) => {
      const series = plans.series.filter((s) => s.category === c.cle);
      const nbV = series.reduce((n, s) => n + s.docs.length, 0);
      return { c, nbS: series.length, nbV };
    })
    .filter((t) => t.nbS > 0); // catégorie sans aucune série : masquée

  return (
    <>
      <Entete titre="Plans & devis" />
      <Erreur message={erreur} />
      <p className="pc-muted pc-petit" style={{ margin: '-8px 0 0' }}>
        Choisis une catégorie. Chaque document garde toutes ses versions.
      </p>

      {tuiles.length === 0 ? (
        <Vide>Aucun document pour l&apos;instant.{proprio ? ' Crée un document (ex. « Plans d’architecture ») puis ajoutes-y les versions.' : ''}</Vide>
      ) : (
        <div className="pc-tuiles">
          {tuiles.map(({ c, nbS, nbV }) => (
            <button
              key={c.cle}
              className="pc-tuile"
              style={nbV ? undefined : { opacity: 0.55 }}
              onClick={() => aller('planCat', c.cle)}
            >
              <span className="pc-ico" style={{ background: 'var(--pc-sapin)' }}><Icone nom={c.icone} /></span>
              <b>{c.nom}</b>
              <small>{nbS} document{nbS > 1 ? 's' : ''} · {nbV === 0 ? 'vide' : `${nbV} version${nbV > 1 ? 's' : ''}`}</small>
            </button>
          ))}
        </div>
      )}

      {proprio && (
        <div style={{ marginTop: 16 }}>
          <button className="pc-btn" onClick={() => setFeuille('serie')}>
            <Icone nom="plus" /> Nouveau document
          </button>
        </div>
      )}

      {/* Anciens fichiers sans série (orphans) : rien ne doit être perdu → à classer. */}
      {proprio && plans.orphans.length > 0 && (
        <div className="pc-liste" style={{ marginTop: 14 }}>
          <button className="pc-ligne" onClick={() => setFeuille('classer')}>
            <span className="pc-pt pc-c-warn"><Icone nom="inbox" /></span>
            <span className="pc-txt">
              <b>{plans.orphans.length} document{plans.orphans.length > 1 ? 's' : ''} à classer</b>
              <small>Anciens fichiers à ranger dans un document</small>
            </span>
            <Icone nom="chevron-right" />
          </button>
        </div>
      )}

      {feuille === 'serie' && (
        <SerieForm
          serie={null}
          cats={toutesCategories(cats, plans.series)}
          onFermer={fermer}
          onOk={async (s) => { fermer(); toast('Document créé'); await recharger(); aller('serie', s.id); }}
        />
      )}
      {feuille === 'classer' && (
        <ClasserFeuille
          orphans={plans.orphans}
          series={plans.series}
          cats={cats}
          onFermer={fermer}
          onClasse={async () => { toast('Document classé'); await recharger(); }}
        />
      )}
    </>
  );
}

// =====================================================================
// 2. PlanCategorie — #planCat/<clé>
// =====================================================================
export function PlanCategorie({ params }: EcranProps) {
  const { aller, toast, proprio } = useChalet();
  const cle = params[0] || '';
  const { donnees, erreur, recharger } = usePlans();
  const [nouveau, setNouveau] = useState(false);
  const fermer = useCallback(() => setNouveau(false), []);

  if (erreur && !donnees) return (<><Entete titre="Plans & devis" retour={() => aller('plans')} /><Erreur message={erreur} /></>);
  if (!donnees) return (<><Entete titre="Plans & devis" retour={() => aller('plans')} /><Chargement /></>);

  const cat = infoCategorie(donnees.cats, cle);
  const series = donnees.plans.series.filter((s) => s.category === cle);

  return (
    <>
      <Entete titre={cat.nom} retour={() => aller('plans')} />
      <Erreur message={erreur} />
      {series.length === 0 ? (
        <Vide>Aucun document dans cette catégorie.</Vide>
      ) : (
        <div className="pc-liste">
          {series.map((s) => {
            const triees = trierVersions(s.docs);
            const courante = triees[0];
            return (
              <div key={s.id} className="pc-ligne">
                {/* Toucher le nom = voir toutes les versions ; bouton rond = ouvrir la version courante tout de suite */}
                <button className="pc-ligne-lien" onClick={() => aller('serie', s.id)}>
                  <span className="pc-pt pc-c-info"><Icone nom={cat.icone} /></span>
                  <span className="pc-txt">
                    <b>{s.name}</b>
                    <small>
                      {courante ? (
                        <>
                          <span className="pc-cote">{etiquette(courante, triees)} · {dateVersion(courante)}</span>
                          {triees.length > 1 ? ` · ${triees.length} versions` : ''}
                        </>
                      ) : 'Vide — dépose le premier fichier'}
                    </small>
                  </span>
                </button>
                {courante ? (
                  <a className="pc-ouvrir" href={urlOuvrir(courante)} target="_blank" rel="noreferrer" aria-label={`Ouvrir ${s.name} (${etiquette(courante, triees)})`}>
                    <Icone nom="eye" />
                  </a>
                ) : <Icone nom="chevron-right" />}
              </div>
            );
          })}
        </div>
      )}

      {proprio && (
        <div style={{ marginTop: 16 }}>
          <button className="pc-btn second" onClick={() => setNouveau(true)}>
            <Icone nom="plus" /> Nouveau document dans {cat.nom}
          </button>
        </div>
      )}

      {nouveau && (
        <SerieForm
          serie={null}
          categorieDefaut={cle}
          cats={toutesCategories(donnees.cats, donnees.plans.series)}
          onFermer={fermer}
          onOk={async (s) => { fermer(); toast('Document créé'); await recharger(); aller('serie', s.id); }}
        />
      )}
    </>
  );
}

// =====================================================================
// 3. Serie — #serie/<serieId>
// ---------------------------------------------------------------------
// Refait le 2026-10-02 (demande Martin : « la visualisation doit être simple »).
// - La VERSION COURANTE est une grande carte : la toucher ouvre le plan directement
//   dans le lecteur du téléphone (plein écran, zoom, toutes les pages). Gros bouton
//   « Ouvrir » en dessous (même effet).
// - Les ANCIENNES VERSIONS sont une liste simple : toucher une ligne = l'ouvrir.
// - Les actions secondaires (télécharger, partager, supprimer) sont dans le menu « ⋯ »
//   de chaque version ; la gestion du document (modifier, ajouter une version,
//   supprimer s'il est vide) dans le « ⋯ » de l'en-tête. Fini la ligne du temps à gauche.
// L'écran Lecteur (#lecteur/...) existe toujours pour les anciens liens.
// =====================================================================
type FeuilleSerie =
  | { t: 'gerer' }
  | { t: 'modifier' }
  | { t: 'version' }
  | { t: 'supprimerSerie' }
  | { t: 'actions'; doc: Doc }
  | { t: 'supprimerVersion'; doc: Doc }
  | { t: 'partager'; doc: Doc }
  | null;

// Adresse qui OUVRE la version (fichier affiché par le navigateur, ou lien externe).
function urlOuvrir(d: Doc): string {
  return estLien(d) ? d.fileUrl || '#' : docFileUrl(d);
}

// Icône selon le type de fichier.
function iconeGenre(d: Doc): string {
  const g = genre(d);
  if (g === 'pdf') return 'file-pdf';
  if (g === 'image') return 'file-image';
  if (g === 'lien') return 'link';
  return 'file';
}

// Libellé du bouton d'ouverture selon le type.
function libelleOuvrir(d: Doc): string {
  const g = genre(d);
  if (g === 'lien') return 'Ouvrir le lien';
  if (g === 'autre') return 'Télécharger';
  return 'Ouvrir';
}

export function Serie({ params }: EcranProps) {
  const { aller, toast, proprio } = useChalet();
  const serieId = Number(params[0]);
  const { donnees, erreur, recharger } = usePlans();
  const [feuille, setFeuille] = useState<FeuilleSerie>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const fermer = useCallback(() => setFeuille(null), []);

  const serie = donnees?.plans.series.find((s) => s.id === serieId) || null;
  const triees = useMemo(() => (serie ? trierVersions(serie.docs) : []), [serie]);

  if (erreur && !donnees) return (<><Entete titre="Plans & devis" /><Erreur message={erreur} /></>);
  if (!donnees) return (<><Entete titre="Plans & devis" /><Chargement /></>);
  if (!serie) return (<><Entete titre="Plans & devis" retour={() => aller('plans')} /><Vide>Ce document n&apos;existe plus.</Vide></>);

  const cat = infoCategorie(donnees.cats, serie.category);
  const courante = triees[0];
  const anciennes = triees.slice(1);

  async function supprimerVersion(doc: Doc) {
    try {
      await ChantierAPI.deleteDoc(doc.id);
      fermer();
      toast('Version supprimée');
      await recharger();
    } catch (e) {
      fermer();
      setErreurAction(messageErreur(e));
    }
  }

  async function supprimerSerie() {
    if (!serie) return;
    try {
      await ChantierAPI.deleteSerie(serie.id);
      fermer();
      toast('Document supprimé');
      aller('planCat', serie.category);
    } catch (e) {
      fermer();
      setErreurAction(messageErreur(e));
    }
  }

  // Ligne d'infos d'une version : date · auteur · taille.
  const infos = (d: Doc) => (
    <>
      <span className="pc-cote">{dateVersion(d)}</span>
      {d.author ? ` · ${d.author}` : ''}
      {fmtSize(d.fileSize) ? ` · ${fmtSize(d.fileSize)}` : ''}
    </>
  );

  return (
    <>
      <Entete
        titre={serie.name}
        retour={() => aller('planCat', serie.category)}
        actions={proprio ? (
          <button className="pc-icobtn" aria-label="Gérer ce document" onClick={() => setFeuille({ t: 'gerer' })}>
            <Icone nom="ellipsis" />
          </button>
        ) : undefined}
      />
      <div className="pc-rangee" style={{ marginTop: -8, marginBottom: 12 }}>
        <Chip v="info"><Icone nom={cat.icone} /> {cat.nom}</Chip>
        <span className="pc-muted pc-petit">{triees.length} version{triees.length > 1 ? 's' : ''}</span>
      </div>
      {serie.description && <p className="pc-muted pc-petit" style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>{serie.description}</p>}
      <Erreur message={erreur || erreurAction} />

      {!courante ? (
        <Vide>Aucune version encore.<br />Dépose le fichier : il sera rangé ici comme première version.</Vide>
      ) : (
        <>
          {/* Version courante : toute la carte ouvre le document */}
          <div className="pc-courante">
            <a className="pc-courante-lien" href={urlOuvrir(courante)} target="_blank" rel="noreferrer" download={genre(courante) === 'autre' ? courante.fileName || undefined : undefined}>
              <span className="pc-gros-ico"><Icone nom={iconeGenre(courante)} /></span>
              <span className="pc-txt">
                <span className="pc-surtitre" style={{ color: 'var(--pc-sapin)' }}>Version courante · {etiquette(courante, triees)}</span>
                <b>{courante.fileName || courante.title}</b>
                <small>{infos(courante)}</small>
              </span>
            </a>
            {courante.notes && <p className="pc-muted pc-petit pc-2l" style={{ margin: '8px 0 0' }}>{courante.notes}</p>}
            <div className="pc-rangee" style={{ marginTop: 12, flexWrap: 'nowrap' }}>
              <a className="pc-btn grand" style={{ flex: 1 }} href={urlOuvrir(courante)} target="_blank" rel="noreferrer" download={genre(courante) === 'autre' ? courante.fileName || undefined : undefined}>
                <Icone nom={genre(courante) === 'autre' ? 'download' : 'eye'} /> {libelleOuvrir(courante)}
              </a>
              <button className="pc-btn second grand" style={{ width: 56, flex: '0 0 auto' }} aria-label="Autres actions pour cette version" onClick={() => setFeuille({ t: 'actions', doc: courante })}>
                <Icone nom="ellipsis" />
              </button>
            </div>
          </div>

          {/* Anciennes versions : une ligne = un toucher pour ouvrir */}
          {anciennes.length > 0 && (
            <>
              <div className="pc-section-titre"><h3>Anciennes versions</h3><span className="pc-muted pc-petit">{anciennes.length}</span></div>
              <div className="pc-liste">
                {anciennes.map((d) => (
                  <div key={d.id} className="pc-ligne">
                    <a className="pc-ligne-lien" href={urlOuvrir(d)} target="_blank" rel="noreferrer" download={genre(d) === 'autre' ? d.fileName || undefined : undefined}>
                      <span className="pc-pt pc-c-neutre"><Icone nom={iconeGenre(d)} /></span>
                      <span className="pc-txt">
                        <b><span className="pc-cote">{etiquette(d, triees)}</span> · {d.fileName || d.title}</b>
                        <small>{infos(d)}</small>
                      </span>
                    </a>
                    <button className="pc-icobtn" aria-label={`Autres actions pour ${etiquette(d, triees)}`} onClick={() => setFeuille({ t: 'actions', doc: d })}>
                      <Icone nom="ellipsis-vertical" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="pc-btn second" onClick={() => aller('depot')}>
          <Icone nom="inbox" /> Déposer une nouvelle version
        </button>
      </div>

      {/* Menu « ⋯ » d'une version */}
      {feuille?.t === 'actions' && (
        <Feuille titre={`${etiquette(feuille.doc, triees)} · ${feuille.doc.fileName || feuille.doc.title}`} onFermer={fermer}>
          <div className="pc-liste">
            <a className="pc-ligne" href={urlOuvrir(feuille.doc)} target="_blank" rel="noreferrer">
              <span className="pc-pt pc-c-ok"><Icone nom="eye" /></span><span className="pc-txt"><b>Ouvrir</b></span>
            </a>
            {!estLien(feuille.doc) && (
              <a className="pc-ligne" href={docDownloadUrl(feuille.doc)} download={feuille.doc.fileName || undefined}>
                <span className="pc-pt pc-c-info"><Icone nom="download" /></span><span className="pc-txt"><b>Télécharger</b></span>
              </a>
            )}
            {triees.length > 1 && (
              <button className="pc-ligne" onClick={() => { const d = feuille.doc; fermer(); aller('lecteur', serie.id, d.id); }}>
                <span className="pc-pt pc-c-info"><Icone nom="code-compare" /></span>
                <span className="pc-txt"><b>Comparer les versions</b><small>Passer d&apos;une version à l&apos;autre dans l&apos;app</small></span>
              </button>
            )}
            {proprio && (
              <button className="pc-ligne" onClick={() => setFeuille({ t: 'partager', doc: feuille.doc })}>
                <span className="pc-pt pc-c-info"><Icone nom="share-nodes" /></span><span className="pc-txt"><b>Partager par lien</b><small>Lien qui expire</small></span>
              </button>
            )}
            {proprio && (
              <button className="pc-ligne" onClick={() => setFeuille({ t: 'supprimerVersion', doc: feuille.doc })}>
                <span className="pc-pt pc-c-bad"><Icone nom="trash-can" /></span><span className="pc-txt"><b style={{ color: 'var(--pc-bad)' }}>Supprimer cette version</b></span>
              </button>
            )}
          </div>
        </Feuille>
      )}

      {/* Menu « ⋯ » du document (propriétaires) */}
      {feuille?.t === 'gerer' && (
        <Feuille titre={serie.name} onFermer={fermer}>
          <div className="pc-liste">
            <button className="pc-ligne" onClick={() => setFeuille({ t: 'version' })}>
              <span className="pc-pt pc-c-ok"><Icone nom="upload" /></span><span className="pc-txt"><b>Ajouter une version</b><small>Fichier ou lien</small></span>
            </button>
            <button className="pc-ligne" onClick={() => setFeuille({ t: 'modifier' })}>
              <span className="pc-pt pc-c-info"><Icone nom="pen" /></span><span className="pc-txt"><b>Renommer / changer de catégorie</b></span>
            </button>
            {triees.length === 0 && (
              <button className="pc-ligne" onClick={() => setFeuille({ t: 'supprimerSerie' })}>
                <span className="pc-pt pc-c-bad"><Icone nom="trash-can" /></span><span className="pc-txt"><b style={{ color: 'var(--pc-bad)' }}>Supprimer ce document</b><small>Possible seulement s&apos;il est vide</small></span>
              </button>
            )}
          </div>
        </Feuille>
      )}

      {feuille?.t === 'modifier' && (
        <SerieForm
          serie={serie}
          cats={toutesCategories(donnees.cats, donnees.plans.series)}
          onFermer={fermer}
          onOk={async () => { fermer(); toast('Document enregistré'); await recharger(); }}
        />
      )}
      {feuille?.t === 'version' && (
        <VersionForm
          serie={serie}
          triees={triees}
          onFermer={fermer}
          onOk={async () => { fermer(); toast('Version ajoutée'); await recharger(); }}
        />
      )}
      {feuille?.t === 'supprimerVersion' && (
        <Confirmer
          message={`Supprimer « ${feuille.doc.fileName || feuille.doc.title} » (${etiquette(feuille.doc, triees)}) ? Cette version sera perdue.`}
          onOui={() => supprimerVersion(feuille.doc)}
          onNon={fermer}
        />
      )}
      {feuille?.t === 'supprimerSerie' && (
        <Confirmer message={`Supprimer le document « ${serie.name} » ? Il ne contient aucune version.`} onOui={supprimerSerie} onNon={fermer} />
      )}
      {feuille?.t === 'partager' && (
        <PartageFeuille doc={feuille.doc} libelle={`${serie.name} ${etiquette(feuille.doc, triees)}`} onFermer={fermer} />
      )}
    </>
  );
}

// =====================================================================
// 4. Lecteur — #lecteur/<serieId>/<docId>
// =====================================================================
export function Lecteur({ params }: EcranProps) {
  const { aller, proprio } = useChalet();
  const serieId = Number(params[0]);
  const docId = Number(params[1]);
  const { donnees, erreur } = usePlans();
  const [partage, setPartage] = useState(false);
  const fermer = useCallback(() => setPartage(false), []);

  const serie = donnees?.plans.series.find((s) => s.id === serieId) || null;
  const triees = useMemo(() => (serie ? trierVersions(serie.docs) : []), [serie]);

  if (erreur && !donnees) return (<><Entete titre="Lecture" /><Erreur message={erreur} /></>);
  if (!donnees) return (<><Entete titre="Lecture" /><Chargement /></>);
  if (!serie) return (<><Entete titre="Lecture" retour={() => aller('plans')} /><Vide>Ce document n&apos;existe plus.</Vide></>);
  if (triees.length === 0) return (<><Entete titre={serie.name} retour={() => aller('serie', serie.id)} /><Vide>Aucune version à afficher.</Vide></>);

  // Version demandée ; introuvable (supprimée ?) → la courante.
  let idx = triees.findIndex((d) => d.id === docId);
  if (idx < 0) idx = 0;
  const doc = triees[idx];
  const courante = triees[0];
  const plusVieille = triees[idx + 1];  // version précédente (plus ancienne)
  const plusRecente = idx > 0 ? triees[idx - 1] : undefined; // version suivante (plus récente)
  const g = genre(doc);
  const url = docFileUrl(doc);

  return (
    <>
      <Entete
        titre={serie.name}
        retour={() => aller('serie', serie.id)}
        actions={proprio ? (
          <button className="pc-icobtn" aria-label="Partager cette version par lien" onClick={() => setPartage(true)}>
            <Icone nom="share-nodes" />
          </button>
        ) : undefined}
      />

      <div className="pc-vchips" role="group" aria-label="Versions">
        {triees.map((d, i) => (
          <button
            key={d.id}
            className={i === idx ? 'on' : ''}
            aria-current={i === idx ? 'true' : undefined}
            onClick={() => { if (i !== idx) aller('lecteur', serie.id, d.id); }}
          >
            {etiquette(d, triees)}{i === 0 ? ' · courante' : ''}
          </button>
        ))}
      </div>

      {idx > 0 && (
        <div className="pc-alerte" style={{ marginBottom: 10 }}>
          <Icone nom="clock-rotate-left" />
          Ancienne version, remplacée par {etiquette(courante, triees)} ({dateVersion(courante)})
        </div>
      )}

      <div className="pc-muted pc-petit" style={{ marginBottom: 8, overflowWrap: 'anywhere' }}>
        <b style={{ color: 'var(--pc-encre)' }}>{doc.fileName || doc.title}</b>
        {' · '}<span className="pc-cote">{dateVersion(doc)}</span>
        {doc.author ? ` · ${doc.author}` : ''}
        {fmtSize(doc.fileSize) ? ` · ${fmtSize(doc.fileSize)}` : ''}
      </div>
      {doc.notes && <p className="pc-muted pc-petit" style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>{doc.notes}</p>}

      {g === 'image' && (
        <div className="pc-lecteur"><img src={url} alt={doc.title} /></div>
      )}
      {g === 'pdf' && (
        <>
          <div className="pc-lecteur"><iframe src={url} title={doc.title} /></div>
          <div style={{ marginTop: 8 }}>
            <a className="pc-lien" href={url} target="_blank" rel="noreferrer">
              <Icone nom="up-right-from-square" /> Ouvrir en plein écran
            </a>
          </div>
        </>
      )}
      {g === 'lien' && (
        <div className="pc-carte">
          <p style={{ marginTop: 0 }}>Cette version est un lien externe.</p>
          <a className="pc-btn" href={doc.fileUrl || '#'} target="_blank" rel="noreferrer">
            <Icone nom="up-right-from-square" /> Ouvrir le lien
          </a>
        </div>
      )}
      {g === 'autre' && (
        <div className="pc-carte">
          <Vide>Aperçu non disponible pour ce type de fichier. Télécharge-le pour l&apos;ouvrir.</Vide>
        </div>
      )}

      <div className="pc-rangee" style={{ marginTop: 10 }}>
        {g !== 'lien' && (
          <a className="pc-btn petit second" href={docDownloadUrl(doc)} download={doc.fileName || undefined}>
            <Icone nom="download" /> Télécharger
          </a>
        )}
        {plusVieille && (
          <button className="pc-btn petit second" onClick={() => aller('lecteur', serie.id, plusVieille.id)} aria-label={`Version précédente : ${etiquette(plusVieille, triees)}`}>
            <Icone nom="arrow-left" /> {etiquette(plusVieille, triees)}
          </button>
        )}
        {plusRecente && (
          <button className="pc-btn petit second" onClick={() => aller('lecteur', serie.id, plusRecente.id)} aria-label={`Version suivante : ${etiquette(plusRecente, triees)}`}>
            {etiquette(plusRecente, triees)} <Icone nom="arrow-right" />
          </button>
        )}
      </div>

      {partage && <PartageFeuille doc={doc} libelle={`${serie.name} ${etiquette(doc, triees)}`} onFermer={fermer} />}
    </>
  );
}

// =====================================================================
// Feuilles (formulaires) — remplacent les anciennes modales
// Important : onFermer doit être stable (useCallback) chez le parent, sinon
// la Feuille reprend le focus à chaque frappe.
// =====================================================================

// ---------- Créer / modifier une série (port de SerieFormModal) ----------
function SerieForm({ serie, cats, categorieDefaut, onFermer, onOk }: {
  serie: PlanSerie | null;
  cats: CategoriePlan[];
  categorieDefaut?: string;
  onFermer: () => void;
  onOk: (s: PlanSerie) => void | Promise<void>;
}) {
  const [nom, setNom] = useState(serie?.name || '');
  const [categorie, setCategorie] = useState<string>(serie?.category || categorieDefaut || cats[0]?.cle || 'AUTRE');
  const [description, setDescription] = useState(serie?.description || '');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    if (!nom.trim()) { setErreur('Donne un nom au document.'); return; }
    setOccupe(true);
    setErreur(null);
    try {
      const category = categorie as CleCategorie; // clé servie par l'API (enum PlanCategorie)
      const r = serie
        ? await ChantierAPI.updateSerie(serie.id, { name: nom.trim(), category, description: description.trim() || null })
        : await ChantierAPI.createSerie({ name: nom.trim(), category, description: description.trim() || undefined });
      await onOk(r.serie);
    } catch (e) {
      setErreur(messageErreur(e));
      setOccupe(false);
    }
  }

  return (
    <Feuille titre={serie ? 'Modifier le document' : 'Nouveau document'} onFermer={onFermer}>
      <Champ id="pc-serie-nom" label="Nom (ex. Plans d'architecture TALO, Plan électrique, Devis cuisine)">
        <input id="pc-serie-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
      </Champ>
      <Champ id="pc-serie-cat" label="Catégorie">
        <select id="pc-serie-cat" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
          {cats.map((c) => <option key={c.cle} value={c.cle}>{c.nom}</option>)}
        </select>
      </Champ>
      <Champ id="pc-serie-desc" label="Description (optionnel)">
        <textarea id="pc-serie-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Champ>
      <Erreur message={erreur} />
      <div style={{ marginTop: 10 }}>
        <button className="pc-btn" disabled={occupe} onClick={enregistrer}>
          {occupe ? 'Enregistrement…' : serie ? 'Enregistrer' : 'Créer le document'}
        </button>
      </div>
    </Feuille>
  );
}

// ---------- Ajouter une version (port de VersionFormModal) ----------
function VersionForm({ serie, triees, onFermer, onOk }: {
  serie: PlanSerie;
  triees: Doc[];
  onFermer: () => void;
  onOk: () => void | Promise<void>;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [lien, setLien] = useState('');
  const [titre, setTitre] = useState('');
  const [version, setVersion] = useState(`v${serie.docs.length + 1}`);
  const [dateEmission, setDateEmission] = useState(new Date().toISOString().slice(0, 10));
  const [auteur, setAuteur] = useState(triees[0]?.author || '');
  const [notes, setNotes] = useState('');
  const [survol, setSurvol] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function choisir(f: File) {
    if (f.size > MAX_MO * 1024 * 1024) {
      setErreur(`Fichier trop gros (${Math.round(f.size / 1024 / 1024)} Mo). Maximum : ${MAX_MO} Mo.`);
      return;
    }
    setErreur(null);
    setFichier(f);
    if (!titre) setTitre(f.name.replace(/\.[^.]+$/, ''));
  }

  function surDepot(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setSurvol(false);
    const f = e.dataTransfer.files?.[0];
    if (f) choisir(f);
  }

  async function enregistrer() {
    if (!fichier && !lien.trim()) { setErreur('Dépose un fichier ou colle un lien.'); return; }
    if (!titre.trim()) { setErreur('Donne un titre.'); return; }
    setOccupe(true);
    setErreur(null);
    try {
      let fileData: string | undefined;
      let mimeType: string | undefined;
      let width: number | undefined;
      let height: number | undefined;
      if (fichier) {
        mimeType = fichier.type || 'application/octet-stream';
        if (fichier.type.startsWith('image/')) {
          // Images : compressées en webp (comme l'ancienne app) pour ménager la base.
          const c = await compressImage(fichier, 2400, 0.85);
          fileData = c.dataUrl; width = c.width; height = c.height; mimeType = 'image/webp';
        } else {
          fileData = await lireDataUrl(fichier);
          // Certains navigateurs donnent « data:;base64 » : on remet le bon type.
          if (!fileData.startsWith('data:') || fileData.startsWith('data:;')) {
            fileData = fileData.replace(/^data:[^;]*;/, `data:${mimeType};`);
          }
        }
      }
      // Type de document selon la catégorie : permis → PERMIS, devis → CONTRAT, sinon PLAN (PDF de plans inclus).
      const kind: DocKind = serie.category === 'PERMIS' ? 'PERMIS' : serie.category === 'DEVIS' ? 'CONTRAT' : 'PLAN';
      await ChantierAPI.createDoc({
        kind,
        title: titre.trim(),
        fileData,
        fileUrl: fichier ? undefined : lien.trim(),
        mimeType, width, height,
        serieId: serie.id,
        version: version.trim() || undefined,
        versionDate: dateEmission || undefined,
        author: auteur.trim() || undefined,
        notes: notes.trim() || undefined,
        fileName: fichier?.name,
        fileSize: fichier?.size,
      });
      await onOk();
    } catch (e) {
      setErreur(messageErreur(e));
      setOccupe(false);
    }
  }

  return (
    <Feuille titre={`Nouvelle version — ${serie.name}`} onFermer={onFermer}>
      <label
        className="pc-depose"
        style={survol ? { background: 'color-mix(in srgb, var(--pc-lac) 16%, transparent)' } : undefined}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setSurvol(true); }}
        onDragLeave={(e) => { e.preventDefault(); setSurvol(false); }}
        onDrop={surDepot}
      >
        <input type="file" aria-label="Choisir un fichier" onChange={(e) => { const f = e.target.files?.[0]; if (f) choisir(f); }} />
        <Icone nom="upload" />{' '}
        {survol ? 'Dépose le fichier ici' : `Glisse le PDF / image / fichier ici ou touche pour choisir (max ${MAX_MO} Mo)`}
        {fichier && (
          <div className="pc-cote" style={{ marginTop: 8, color: 'var(--pc-encre)', overflowWrap: 'anywhere' }}>
            {fichier.name} · {fmtSize(fichier.size)}
          </div>
        )}
      </label>
      {fichier && (
        <div style={{ marginTop: 6 }}>
          <button className="pc-lien" onClick={() => setFichier(null)}>Retirer le fichier</button>
        </div>
      )}
      <div style={{ height: 12 }} />
      {!fichier && (
        <Champ id="pc-v-lien" label="…ou lien externe (Drive, site, galerie)">
          <input id="pc-v-lien" type="url" inputMode="url" placeholder="https://…" value={lien} onChange={(e) => setLien(e.target.value)} />
        </Champ>
      )}
      <Champ id="pc-v-titre" label="Titre">
        <input id="pc-v-titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      </Champ>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Champ id="pc-v-version" label="Version">
            <input id="pc-v-version" value={version} placeholder="v2 – révisé" onChange={(e) => setVersion(e.target.value)} />
          </Champ>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Champ id="pc-v-date" label="Date d'émission">
            <input id="pc-v-date" type="date" value={dateEmission} onChange={(e) => setDateEmission(e.target.value)} />
          </Champ>
        </div>
      </div>
      <Champ id="pc-v-auteur" label="Auteur / émetteur (TALO, SGDA, arpenteur, électricien…)">
        <input id="pc-v-auteur" value={auteur} onChange={(e) => setAuteur(e.target.value)} />
      </Champ>
      <Champ id="pc-v-notes" label="Notes (ce qui a changé dans cette version)">
        <textarea id="pc-v-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Champ>
      <Erreur message={erreur} />
      <div style={{ marginTop: 10 }}>
        <button className="pc-btn" disabled={occupe} onClick={enregistrer}>
          {occupe ? 'Téléversement…' : 'Ajouter la version'}
        </button>
      </div>
    </Feuille>
  );
}

// ---------- Classer les anciens documents sans série (port de ClasserDocModal) ----------
function ClasserFeuille({ orphans, series, cats, onFermer, onClasse }: {
  orphans: Doc[];
  series: PlanSerie[];
  cats: CategoriePlan[];
  onFermer: () => void;
  onClasse: () => void | Promise<void>;
}) {
  const [choisi, setChoisi] = useState<Doc | null>(null);
  const [serieId, setSerieId] = useState(series[0] ? String(series[0].id) : '');
  const [version, setVersion] = useState('');
  const [dateEmission, setDateEmission] = useState('');
  const [auteur, setAuteur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function ouvrir(d: Doc) {
    setChoisi(d);
    setVersion(d.version || '');
    setDateEmission((d.versionDate || d.createdAt || '').slice(0, 10));
    setAuteur(d.author || '');
    setErreur(null);
  }

  async function classer() {
    if (!choisi) return;
    if (!serieId) { setErreur('Choisis un document de destination.'); return; }
    setOccupe(true);
    setErreur(null);
    try {
      await ChantierAPI.updateDoc(choisi.id, {
        serieId: Number(serieId),
        version: version.trim() || null,
        versionDate: dateEmission || null,
        author: auteur.trim() || null,
      });
      setChoisi(null);
      setOccupe(false);
      await onClasse(); // la liste se recharge ; la feuille reste ouverte pour le suivant
    } catch (e) {
      setErreur(messageErreur(e));
      setOccupe(false);
    }
  }

  // Étape 2 : formulaire de classement d'un document.
  if (choisi) {
    return (
      <Feuille titre="Classer le document" onFermer={onFermer}>
        <p className="pc-muted" style={{ marginTop: 0, overflowWrap: 'anywhere' }}>{choisi.title}</p>
        {series.length === 0 ? (
          <Vide>Crée d&apos;abord un document (bouton « Nouveau document ») pour y ranger ce fichier.</Vide>
        ) : (
          <>
            <Champ id="pc-c-serie" label="Document de destination">
              <select id="pc-c-serie" value={serieId} onChange={(e) => setSerieId(e.target.value)}>
                {series.map((s) => <option key={s.id} value={s.id}>{infoCategorie(cats, s.category).nom} — {s.name}</option>)}
              </select>
            </Champ>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Champ id="pc-c-version" label="Version">
                  <input id="pc-c-version" value={version} onChange={(e) => setVersion(e.target.value)} />
                </Champ>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Champ id="pc-c-date" label="Date d'émission">
                  <input id="pc-c-date" type="date" value={dateEmission} onChange={(e) => setDateEmission(e.target.value)} />
                </Champ>
              </div>
            </div>
            <Champ id="pc-c-auteur" label="Auteur / émetteur">
              <input id="pc-c-auteur" value={auteur} onChange={(e) => setAuteur(e.target.value)} />
            </Champ>
          </>
        )}
        <Erreur message={erreur} />
        <div className="pc-rangee" style={{ marginTop: 10 }}>
          <button className="pc-btn" style={{ flex: 1 }} disabled={occupe || series.length === 0} onClick={classer}>
            {occupe ? 'Enregistrement…' : 'Classer'}
          </button>
          <button className="pc-btn second" style={{ flex: 1 }} onClick={() => setChoisi(null)}>Retour à la liste</button>
        </div>
      </Feuille>
    );
  }

  // Étape 1 : liste des documents à classer.
  return (
    <Feuille titre="Documents à classer" onFermer={onFermer}>
      {orphans.length === 0 ? (
        <Vide>Tout est classé.</Vide>
      ) : (
        <div className="pc-liste">
          {orphans.map((d) => (
            <div key={d.id} className="pc-ligne">
              <span className="pc-txt">
                <b>{d.title}</b>
                <small>{dateCourte(d.createdAt)}{fmtSize(d.fileSize) ? ` · ${fmtSize(d.fileSize)}` : ''}</small>
              </span>
              <a className="pc-btn petit second" href={docFileUrl(d)} target="_blank" rel="noreferrer" aria-label={`Ouvrir ${d.title}`}>
                <Icone nom="eye" />
              </a>
              <button className="pc-btn petit" onClick={() => ouvrir(d)}>Classer</button>
            </div>
          ))}
        </div>
      )}
    </Feuille>
  );
}

// ---------- Partager une version par lien temporaire (proprio) ----------
function PartageFeuille({ doc, libelle, onFermer }: { doc: Doc; libelle: string; onFermer: () => void }) {
  const { toast } = useChalet();
  const [jours, setJours] = useState(7);
  const [url, setUrl] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  async function creer() {
    setOccupe(true);
    setErreur(null);
    try {
      const r = await ProjetChaletAPI.partager(doc.id, jours);
      setUrl(r.partage.url);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  async function copier() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast('Lien copié');
      return;
    } catch {
      // Repli (vieux navigateurs / contexte non sécurisé) : sélection + copie classique.
    }
    const el = champ.current;
    if (el) {
      el.focus();
      el.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      toast(ok ? 'Lien copié' : 'Lien sélectionné : copie-le manuellement');
    }
  }

  return (
    <Feuille titre="Partager par lien" onFermer={onFermer}>
      <p className="pc-muted pc-petit" style={{ marginTop: 0, overflowWrap: 'anywhere' }}>
        {libelle} — toute personne qui a le lien pourra voir ce fichier, sans compte, jusqu&apos;à l&apos;expiration.
      </p>
      {!url ? (
        <>
          <div className="pc-segment" role="group" aria-label="Durée du lien">
            {[1, 7, 30].map((j) => (
              <button key={j} className={jours === j ? 'on' : ''} aria-pressed={jours === j} onClick={() => setJours(j)}>
                {j} jour{j > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <Erreur message={erreur} />
          <div style={{ marginTop: 10 }}>
            <button className="pc-btn" disabled={occupe} onClick={creer}>
              <Icone nom="link" /> {occupe ? 'Création…' : 'Créer le lien'}
            </button>
          </div>
        </>
      ) : (
        <>
          <Champ id="pc-partage-url" label={`Lien (valide ${jours} jour${jours > 1 ? 's' : ''})`}>
            <input id="pc-partage-url" ref={champ} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          </Champ>
          <div className="pc-rangee">
            <button className="pc-btn" style={{ flex: 1 }} onClick={copier}><Icone nom="copy" /> Copier</button>
            <button className="pc-btn second" style={{ flex: 1 }} onClick={onFermer}>Fermer</button>
          </div>
        </>
      )}
    </Feuille>
  );
}
