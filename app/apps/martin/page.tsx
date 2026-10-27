'use client';

// Tableau de bord des projets de Martin et FRIDAY.
// Les données viennent uniquement de GET /api/martin/projets (jeton de session).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';
import { ErreurProjets, chargerDossierMartin } from '@/lib/martin-projets-api';
import {
  categoriesDe,
  compterParEtat,
  filtrerProjets,
  formaterMisAJour,
  largeurBarre,
  libelleStatut,
  mentionPourcentage,
  texteAvancement,
  tonEtat,
  type DossierProjets,
  type Projet,
  type TonEtat,
} from '@/lib/martin-projets';

const TON: Record<TonEtat, { pastille: string; barre: string }> = {
  cours: { pastille: 'bg-sky-400/15 text-sky-100 border-sky-400/35', barre: 'bg-sky-400' },
  attente: { pastille: 'bg-amber-400/15 text-amber-100 border-amber-400/35', barre: 'bg-amber-400' },
  livre: { pastille: 'bg-emerald-400/15 text-emerald-100 border-emerald-400/35', barre: 'bg-emerald-400' },
  bloque: { pastille: 'bg-rose-400/15 text-rose-100 border-rose-400/40', barre: 'bg-rose-400' },
  neutre: { pastille: 'bg-white/10 text-white/75 border-white/15', barre: 'bg-slate-300' },
};

const TON_JALON: Record<string, string> = {
  fait: 'bg-emerald-400/15 text-emerald-100 border-emerald-400/30',
  en_cours: 'bg-sky-400/15 text-sky-100 border-sky-400/35',
  a_faire: 'bg-white/10 text-white/60 border-white/15',
  bloque: 'bg-rose-400/15 text-rose-100 border-rose-400/40',
};

function idDepuisHash(): string | null {
  if (typeof window === 'undefined') return null;
  const id = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
  return id || null;
}

function Pastille({ etat }: { etat: string }) {
  const ton = TON[tonEtat(etat)];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 ${ton.pastille}`}>
      {etat}
    </span>
  );
}

function Barre({ projet }: { projet: Projet }) {
  const largeur = largeurBarre(projet);
  const libelle = texteAvancement(projet);
  const valeur = projet.avancement.pourcentage;
  return (
    <div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valeur == null ? undefined : largeur}
        aria-label={libelle}
      >
        <div className={`h-full rounded-full ${TON[tonEtat(projet.etat)].barre}`} style={{ width: `${largeur}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-white/55">{libelle}</p>
    </div>
  );
}

function CarteProjet({ projet, onOuvrir }: { projet: Projet; onOuvrir: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOuvrir(projet.id)}
      className="glass w-full rounded-2xl p-3.5 text-left transition active:bg-white/5"
      aria-label={`Ouvrir ${projet.nom}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold leading-snug text-white">{projet.nom}</h2>
        <FontAwesomeIcon icon={UI.chevronRight} className="mt-1 shrink-0 text-[10px] text-white/30" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">{projet.categorie}</span>
        <Pastille etat={projet.etat} />
      </div>
      <div className="mt-3">
        <Barre projet={projet} />
      </div>
    </button>
  );
}

function Bloc({
  titre,
  compte,
  vide,
  accent,
  children,
}: {
  titre: string;
  compte: number;
  vide: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
      style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
    >
      <h2 className="flex items-baseline justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
        {titre}
        <span className="font-mono text-[11px] tracking-normal text-white/35">{compte}</span>
      </h2>
      {compte === 0 ? (
        <p className="mt-2 text-sm text-white/45">{vide}</p>
      ) : (
        <div className="mt-2.5">{children}</div>
      )}
    </section>
  );
}

function Detail({
  projet,
  onRetour,
}: {
  projet: Projet;
  onRetour: () => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onRetour}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-300"
      >
        <FontAwesomeIcon icon={UI.back} className="text-xs" />
        Projets
      </button>

      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-300/70">{projet.categorie}</p>
        <h1 id="martin-detail-titre" tabIndex={-1} className="mt-1 font-display text-2xl font-semibold leading-tight text-white outline-none">
          {projet.nom}
        </h1>
        <div className="mt-2">
          <Pastille etat={projet.etat} />
        </div>
        {projet.resume && (
          <p className="mt-3 text-sm leading-relaxed text-white/75">{projet.resume}</p>
        )}
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
        <Barre projet={projet} />
        <p className="mt-2 text-xs leading-relaxed text-white/40">{mentionPourcentage(projet)}</p>
      </div>

      <Bloc titre="Blocages" compte={projet.blocages.length} vide="Aucun blocage." accent="#fb7185">
        <ul className="space-y-2">
          {projet.blocages.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-snug text-rose-50/90">
              <FontAwesomeIcon icon={UI.warning} className="mt-0.5 text-xs text-rose-300/80" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Bloc>

      <Bloc titre="En attente" compte={projet.en_attente.length} vide="Rien en attente." accent="#fbbf24">
        <ul className="space-y-3">
          {projet.en_attente.map((item) => (
            <li key={`${item.qui}-${item.point}`} className="text-sm leading-snug text-white/85">
              <p>{item.point}</p>
              <p className="mt-1 text-xs font-medium text-amber-200/80">Qui : {item.qui}</p>
            </li>
          ))}
        </ul>
      </Bloc>

      <Bloc titre="Prochaines étapes" compte={projet.prochaines_etapes.length} vide="Aucune prochaine étape." accent="#38bdf8">
        <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-snug text-white/85">
          {projet.prochaines_etapes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </Bloc>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
          Jalons
          <span className="ml-2 font-mono tracking-normal text-white/35">{projet.jalons.length}</span>
        </h2>
        {projet.jalons.length === 0 ? (
          <p className="mt-2 text-sm text-white/45">Aucun jalon.</p>
        ) : (
          <ul className="mt-2.5 space-y-2">
            {projet.jalons.map((jalon) => (
              <li key={`${jalon.statut}-${jalon.titre}`} className="flex items-start gap-2">
                <span className={`mt-0.5 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 ${TON_JALON[jalon.statut] || TON_JALON.a_faire}`}>
                  {libelleStatut(jalon.statut)}
                </span>
                <span className="text-sm leading-snug text-white/85">{jalon.titre}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {projet.references.length > 0 && (
        <section className="px-1 pb-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Références</h2>
          <ul className="mt-1.5 space-y-1">
            {projet.references.map((ref) => (
              <li key={ref} className="break-all text-xs text-white/35">{ref}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function MartinPage() {
  const router = useRouter();
  const [dossier, setDossier] = useState<DossierProjets | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [categorie, setCategorie] = useState<string | null>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [projetId, setProjetId] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await chargerDossierMartin();
      setDossier(data);
    } catch (e) {
      const err = e instanceof ErreurProjets ? e : new ErreurProjets('Impossible de charger les projets.');
      if (err.status === 401) {
        router.push('/');
        return;
      }
      setDossier(null);
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }, [router]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    const sync = () => setProjetId(idDepuisHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    document.title = 'Martin — Mission Control';
    window.scrollTo(0, 0);
  }, [projetId]);

  const projets = dossier?.projets ?? [];
  const categories = useMemo(() => categoriesDe(projets), [projets]);
  // Les compteurs suivent la catégorie choisie, pas le filtre d'état (sinon le bouton actif se viderait).
  const pourCompteurs = useMemo(
    () => filtrerProjets(projets, categorie, null),
    [projets, categorie],
  );
  const compteurs = useMemo(
    () => compterParEtat(pourCompteurs, dossier?.etats_possibles ?? []),
    [pourCompteurs, dossier],
  );
  const visibles = useMemo(
    () => filtrerProjets(projets, categorie, etat),
    [projets, categorie, etat],
  );
  const projetOuvert = projetId ? projets.find((p) => p.id === projetId) ?? null : null;

  function ouvrir(id: string) {
    window.location.hash = encodeURIComponent(id);
  }

  function retourListe() {
    // Le téléphone recule dans l'historique (le #projet a été empilé). Si on est
    // arrivé directement sur un lien de projet, on retire simplement le #.
    if (window.location.hash && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setProjetId(null);
  }

  function reinitialiserFiltres() {
    setCategorie(null);
    setEtat(null);
  }

  const dateMaj = dossier?.mis_a_jour ? formaterMisAJour(dossier.mis_a_jour) : '';

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 cosmic-grid opacity-50" />
      <div className="blob bg-sky-600 w-[280px] h-[280px] -top-16 right-0 opacity-25" />

      <div
        className="relative z-10 mx-auto w-full max-w-lg px-4 pb-10"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
      >
        {chargement && (
          <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-white/55">
            <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
            <p className="text-sm">Chargement des projets…</p>
          </div>
        )}

        {!chargement && erreur && (
          <div className="pt-2">
            <a href="/dashboard?realm=work" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
              <FontAwesomeIcon icon={UI.back} className="text-xs" />
              Travail
            </a>
            <div className="glass mt-6 rounded-2xl p-5" role="alert">
              <p className="font-display text-lg font-semibold text-white">Projets inaccessibles</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{erreur}</p>
              <button
                type="button"
                onClick={charger}
                className="mt-4 rounded-xl border border-sky-400/30 px-4 text-sm font-medium text-sky-200"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {!chargement && !erreur && dossier && projetOuvert && (
          <Detail projet={projetOuvert} onRetour={retourListe} />
        )}

        {!chargement && !erreur && dossier && projetId && !projetOuvert && (
          <div className="pt-2">
            <button type="button" onClick={retourListe} className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
              <FontAwesomeIcon icon={UI.back} className="text-xs" />
              Projets
            </button>
            <div className="glass mt-6 rounded-2xl p-5">
              <p className="text-sm text-white/70">Ce projet n&apos;est pas dans la liste.</p>
            </div>
          </div>
        )}

        {!chargement && !erreur && dossier && !projetId && (
          <div>
            <a href="/dashboard?realm=work" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
              <FontAwesomeIcon icon={UI.back} className="text-xs" />
              Travail
            </a>

            <header className="mt-4 mb-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Travail</p>
              <h1 className="mt-1 font-display text-[1.65rem] font-semibold leading-tight text-white">
                {dossier.titre}
              </h1>
              {dateMaj && (
                <p className="mt-2 text-sm text-white/55">Mis à jour le {dateMaj}</p>
              )}
              <p className="mt-1 text-xs leading-relaxed text-white/40">{mentionPourcentage()}</p>
              {dossier.source && (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/30">{dossier.source}</p>
              )}
            </header>

            {projets.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-center text-sm text-white/60">
                Aucun projet pour l&apos;instant.
              </div>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label="Filtrer par état">
                  {compteurs.map(({ etat: nom, n }) => {
                    const actif = etat === nom;
                    const ton = TON[tonEtat(nom)];
                    return (
                      <button
                        key={nom}
                        type="button"
                        aria-pressed={actif}
                        onClick={() => setEtat(actif ? null : nom)}
                        className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left ${actif ? ton.pastille : 'border-white/10 bg-white/[0.03] text-white/70'}`}
                      >
                        <span className="font-display text-lg font-semibold leading-none tabular-nums">{n}</span>
                        <span className="mt-1 text-[11px] leading-tight">{nom}</span>
                      </button>
                    );
                  })}
                </div>

                <label className="mb-3 block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Catégorie</span>
                  <select
                    value={categorie ?? ''}
                    onChange={(e) => setCategorie(e.target.value || null)}
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-base text-white"
                  >
                    <option value="">Toutes les catégories</option>
                    {categories.map((nom) => (
                      <option key={nom} value={nom}>{nom}</option>
                    ))}
                  </select>
                </label>

                <p className="mb-2 text-xs text-white/40">
                  {visibles.length === 1 ? '1 projet' : `${visibles.length} projets`}
                </p>

                {visibles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 p-5 text-center">
                    <p className="text-sm text-white/60">Aucun projet pour ce filtre.</p>
                    <button
                      type="button"
                      onClick={reinitialiserFiltres}
                      className="mt-3 text-sm font-medium text-sky-300"
                    >
                      Tout afficher
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {visibles.map((projet) => (
                      <CarteProjet key={projet.id} projet={projet} onOuvrir={ouvrir} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
