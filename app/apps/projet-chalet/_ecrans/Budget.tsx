'use client';

// =====================================================================
// BUDGET — écran « budget » de Projet chalet (tuile « budget », privée par défaut).
// ---------------------------------------------------------------------
// Porté de l'ancienne app Chantier (BudgetView + BanqueSection + BudgetFormModal
// + DepenseFormModal + la carte « Avancement officiel banque » de l'Aperçu).
//
// Vocabulaire (l'ancienne app disait « Déboursé » pour deux choses différentes) :
//  - « Déboursés banque » = les tranches versées par la banque (financement construction).
//  - « Paiements »        = l'argent qu'on a payé aux fournisseurs (table Depense).
//
// Routes API (lib/chantier-api.ts → backend src/routes/chantier.js) :
//  - GET    /chantier/overview        → budget total/engagé/payé/restant, banque, avancementBanque, statut par métier
//  - PATCH  /chantier/project         → budget total (ADMIN seulement = Martin ; sinon 403, message affiché)
//  - GET    /chantier/trades          → budget prévu par métier (Trade.budgetPrevu)
//  - GET/POST/PATCH/DELETE /chantier/debourses[/:id] → déboursés banque
//  - GET/POST/DELETE       /chantier/depenses[/:id]  → paiements
// Invité (tuile cochée) : lecture seule, aucun bouton d'écriture (le backend refuse aussi).
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChantierAPI,
  type Overview, type Depense, type DepenseType, type DebourseBanque, type Trade, type TradeSummary,
} from '@/lib/chantier-api';
import {
  useChalet, Entete, Icone, Chip, Vide, Erreur, Chargement, Feuille, Confirmer, Champ,
  dateCourte, argent, type EcranProps,
} from '../_kit/ui';

// ---------- Libellés ----------
const TYPES_PAIEMENT: Array<{ value: DepenseType; label: string }> = [
  { value: 'DEPOT', label: 'Dépôt' },
  { value: 'PARTIEL', label: 'Paiement partiel' },
  { value: 'FINAL', label: 'Paiement final' },
  { value: 'EXTRA', label: 'Extra' },
];
const libelleType = (t: DepenseType) => TYPES_PAIEMENT.find((x) => x.value === t)?.label || t;

// Statut d'un corps de métier (calculé par /overview) → puce.
const STATUT_METIER: Record<TradeSummary['statut'], { label: string; v: 'ok' | 'warn' | 'info' | 'neutre' }> = {
  A_VENIR: { label: 'À venir', v: 'neutre' },
  SOUMISSIONS: { label: 'Soumissions', v: 'warn' },
  ATTRIBUE: { label: 'Attribué', v: 'info' },
  EN_COURS: { label: 'En cours', v: 'warn' },
  TERMINE: { label: 'Terminé', v: 'ok' },
};

// Date ISO → valeur d'un <input type="date"> (AAAA-MM-JJ).
const versInputDate = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');
// Montant tapé (« 95 000 », « 95000,50 ») → entier en dollars.
const lireMontant = (s: string) => Math.round(Number(s.replace(/\s/g, '').replace(',', '.')) || 0);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Erreur inattendue.');

type FeuilleOuverte =
  | { type: 'budget' }
  | { type: 'debourse'; d: DebourseBanque | null } // null = nouveau
  | { type: 'paiement' }
  | null;

type Confirmation = { message: string; action: () => Promise<void> } | null;

export default function Budget(_: EcranProps) {
  const { toast, proprio } = useChalet();

  const [ov, setOv] = useState<Overview | null>(null);
  const [paiements, setPaiements] = useState<Depense[]>([]);
  const [debourses, setDebourses] = useState<DebourseBanque[]>([]);
  const [metiers, setMetiers] = useState<Trade[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [feuille, setFeuille] = useState<FeuilleOuverte>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [metiersOuverts, setMetiersOuverts] = useState(false);

  // Callbacks STABLES : la Feuille refocalise à chaque changement de onFermer.
  const fermer = useCallback(() => setFeuille(null), []);
  const annulerConfirmation = useCallback(() => setConfirmation(null), []);

  const charger = useCallback(async () => {
    try {
      const [o, dep, deb, tr] = await Promise.all([
        ChantierAPI.overview(),
        ChantierAPI.depenses(),
        ChantierAPI.debourses(),
        ChantierAPI.trades().catch(() => ({ trades: [] as Trade[] })), // non bloquant
      ]);
      setOv(o); setPaiements(dep.depenses); setDebourses(deb.debourses); setMetiers(tr.trades);
      setErreur(null);
    } catch (e) {
      setErreur(msg(e));
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  // Paiements du plus récent au plus ancien (date de paiement).
  const paiementsTries = useMemo(
    () => [...paiements].sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || '') || b.id - a.id),
    [paiements],
  );
  // Payé par métier (pour la liste « Budget par métier »).
  const payeParMetier = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of paiements) if (p.tradeId) m.set(p.tradeId, (m.get(p.tradeId) || 0) + (p.amount || 0));
    return m;
  }, [paiements]);

  if (erreur && !ov) return (<><Entete titre="Budget" /><Erreur message={erreur} /></>);
  if (!ov) return (<><Entete titre="Budget" /><Chargement /></>);

  const b = ov.budget;
  const totalPrevu = debourses.reduce((a, d) => a + (d.amount || 0), 0);
  const totalRecu = debourses.filter((d) => d.recu).reduce((a, d) => a + (d.amount || 0), 0);
  const prochain = debourses.find((d) => !d.recu) || null;
  const statutParId = new Map(ov.trades.map((t) => [t.id, t]));
  const totalMetiers = metiers.reduce((a, t) => a + (t.budgetPrevu || 0), 0);

  // ---- Actions ----
  async function basculerRecu(d: DebourseBanque) {
    try {
      await ChantierAPI.updateDebourse(d.id, { recu: !d.recu });
      toast(d.recu ? 'Déboursé remis à « prévu »' : 'Déboursé marqué reçu ✓');
      await charger();
    } catch (e) { setErreur(msg(e)); }
  }
  function demanderSuppressionDebourse(d: DebourseBanque) {
    setFeuille(null);
    setConfirmation({
      message: `Supprimer le déboursé banque « ${d.label} » (${argent(d.amount)}) ?`,
      action: async () => {
        try { await ChantierAPI.deleteDebourse(d.id); toast('Déboursé banque supprimé'); await charger(); }
        catch (e) { setErreur(msg(e)); }
        setConfirmation(null);
      },
    });
  }
  function demanderSuppressionPaiement(p: Depense) {
    setConfirmation({
      message: `Supprimer le paiement « ${p.label || p.trade?.name || 'Paiement'} » (${argent(p.amount)}) ?`,
      action: async () => {
        try { await ChantierAPI.deleteDepense(p.id); toast('Paiement supprimé'); await charger(); }
        catch (e) { setErreur(msg(e)); }
        setConfirmation(null);
      },
    });
  }
  const apresEnregistrement = async (texte: string) => { setFeuille(null); toast(texte); await charger(); };

  return (
    <>
      <Entete titre="Budget" />
      <Erreur message={erreur} />

      {/* ---------- KPIs ---------- */}
      <div className="pc-kpis" style={{ marginTop: erreur ? 10 : 0 }}>
        {proprio ? (
          <button className="pc-kpi" style={{ textAlign: 'left' }} onClick={() => setFeuille({ type: 'budget' })} aria-label={`Budget total ${argent(b.total)}, modifier`}>
            <span className="pc-surtitre">Budget total <Icone nom="pen" /></span>
            <b>{argent(b.total)}</b>
          </button>
        ) : (
          <div className="pc-kpi"><span className="pc-surtitre">Budget total</span><b>{argent(b.total)}</b></div>
        )}
        <div className="pc-kpi"><span className="pc-surtitre">Engagé</span><b>{argent(b.engage)}</b></div>
        <div className="pc-kpi"><span className="pc-surtitre">Payé</span><b>{argent(b.paye)}</b></div>
        <div className="pc-kpi">
          <span className="pc-surtitre">Restant</span>
          <b style={b.restant < 0 ? { color: 'var(--pc-bad)' } : undefined}>{argent(b.restant)}</b>
        </div>
      </div>
      <p className="pc-muted pc-petit" style={{ margin: '6px 2px 0' }}>
        Engagé = soumissions acceptées · Restant = budget total − engagé
      </p>

      {/* ---------- Avancement officiel (grille d'inspection de la banque) ---------- */}
      {ov.avancementBanque !== undefined && (
        <div className="pc-carte" style={{ marginTop: 12 }}>
          <div className="pc-meta" style={{ marginTop: 0 }}>
            <span className="pc-surtitre"><Icone nom="building-columns" /> Avancement officiel (banque)</span>
            <span className="pc-cote" style={{ color: 'var(--pc-sapin)', fontSize: 16 }}>{ov.avancementBanque} %</span>
          </div>
          <div className="pc-barre" role="img" aria-label={`Avancement banque ${ov.avancementBanque} %`} style={{ marginTop: 8 }}>
            <i style={{ width: `${Math.min(100, ov.avancementBanque)}%` }} />
          </div>
          {prochain && (
            <div className="pc-petit" style={{ marginTop: 8 }}>
              Prochain déboursé banque : <b className="pc-cote">{argent(prochain.amount)}</b> — {prochain.label}
              {prochain.datePrevue && <span className="pc-muted"> · prévu {dateCourte(prochain.datePrevue)}</span>}
            </div>
          )}
          <div className="pc-muted pc-petit" style={{ marginTop: 4 }}>Grille d'inspection progressive : se coche dans les jalons.</div>
        </div>
      )}

      {/* ---------- Déboursés banque ---------- */}
      <div className="pc-section-titre">
        <h3>Déboursés banque</h3>
        {proprio && <button className="pc-lien" onClick={() => setFeuille({ type: 'debourse', d: null })}><Icone nom="plus" /> Ajouter</button>}
      </div>
      {debourses.length > 0 && (
        <div className="pc-carte">
          <div className="pc-petit">
            Reçu <b className="pc-cote">{argent(totalRecu)}</b> / prévu <b className="pc-cote">{argent(totalPrevu)}</b>
            {b.total > 0 && totalPrevu > 0 && <span className="pc-muted"> · {pct(totalPrevu, b.total)} % du budget couvert par le financement</span>}
          </div>
          {totalPrevu > 0 && (
            <div className="pc-barre" role="img" aria-label={`Reçu ${pct(totalRecu, totalPrevu)} % du prévu`} style={{ marginTop: 8 }}>
              <i style={{ width: `${Math.min(100, pct(totalRecu, totalPrevu))}%` }} />
            </div>
          )}
        </div>
      )}
      {debourses.length === 0 ? (
        <div className="pc-liste"><Vide>Aucun déboursé banque.{proprio ? ' Ajoute les tranches de ton financement.' : ''}</Vide></div>
      ) : (
        <div className="pc-liste">
          {debourses.map((d) => (
            <div key={d.id} className="pc-ligne">
              {proprio ? (
                <button
                  className={`pc-pt ${d.recu ? 'pc-c-ok' : 'pc-c-neutre'}`}
                  style={{ border: 0 }}
                  onClick={() => basculerRecu(d)}
                  aria-label={d.recu ? `Marquer « ${d.label} » non reçu` : `Marquer « ${d.label} » reçu`}
                  aria-pressed={d.recu}
                >
                  <Icone nom={d.recu ? 'check' : 'building-columns'} />
                </button>
              ) : (
                <span className={`pc-pt ${d.recu ? 'pc-c-ok' : 'pc-c-neutre'}`} aria-hidden="true"><Icone nom={d.recu ? 'check' : 'building-columns'} /></span>
              )}
              <span className="pc-txt">
                <b>{d.label}</b>
                <small>
                  {d.recu ? `Reçu le ${dateCourte(d.dateRecu)}` : `Prévu : ${dateCourte(d.datePrevue)}`}
                  {d.condition ? ` · ${d.condition}` : ''}
                </small>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span className="pc-cote" style={{ display: 'block', color: d.recu ? 'var(--pc-ok)' : undefined }}>{argent(d.amount)}</span>
                <Chip v={d.recu ? 'ok' : 'neutre'}>{d.recu ? 'Reçu' : 'Prévu'}</Chip>
              </span>
              {proprio && (
                <button className="pc-icobtn" onClick={() => setFeuille({ type: 'debourse', d })} aria-label={`Modifier « ${d.label} »`}>
                  <Icone nom="pen" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------- Paiements (dépenses) ---------- */}
      <div className="pc-section-titre">
        <h3>Paiements</h3>
        <span className="pc-muted pc-petit">{paiements.length} · {argent(b.paye)}</span>
      </div>
      {proprio && (
        <div style={{ marginBottom: 8 }}>
          <button className="pc-btn" onClick={() => setFeuille({ type: 'paiement' })}><Icone nom="plus" /> Ajouter un paiement</button>
        </div>
      )}
      {paiementsTries.length === 0 ? (
        <div className="pc-liste"><Vide>Aucun paiement pour l'instant.</Vide></div>
      ) : (
        <div className="pc-liste">
          {paiementsTries.map((p) => (
            <div key={p.id} className="pc-ligne">
              <span className="pc-txt">
                <b>{p.label || p.trade?.name || 'Paiement'}</b>
                <small>
                  {[libelleType(p.type), dateCourte(p.paidAt), p.label ? p.trade?.name : null, p.jalon?.name].filter(Boolean).join(' · ')}
                </small>
              </span>
              <span className="pc-cote">{argent(p.amount)}</span>
              {proprio && (
                <button className="pc-icobtn" style={{ color: 'var(--pc-bad)' }} onClick={() => demanderSuppressionPaiement(p)} aria-label={`Supprimer le paiement « ${p.label || p.trade?.name || 'Paiement'} »`}>
                  <Icone nom="trash" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------- Budget par métier (repliable) ---------- */}
      {metiers.length > 0 && (
        <>
          <div className="pc-section-titre">
            <h3>Budget par métier</h3>
            <button className="pc-lien" onClick={() => setMetiersOuverts((x) => !x)} aria-expanded={metiersOuverts} aria-controls="pc-budget-metiers">
              {metiersOuverts ? 'Replier' : `Voir (${metiers.length})`} <Icone nom={metiersOuverts ? 'chevron-up' : 'chevron-down'} />
            </button>
          </div>
          {metiersOuverts && (
            <div className="pc-liste" id="pc-budget-metiers">
              {metiers.map((t) => {
                const s = statutParId.get(t.id);
                const st = s ? STATUT_METIER[s.statut] : null;
                const paye = payeParMetier.get(t.id) || 0;
                return (
                  <div key={t.id} className="pc-ligne">
                    <span className="pc-txt">
                      <b>{t.name}</b>
                      <small>
                        Prévu {argent(t.budgetPrevu)}{paye > 0 ? ` · payé ${argent(paye)}` : ''}
                        {s && s.soumissionsCount > 0 ? ` · ${s.soumissionsCount} soumission${s.soumissionsCount > 1 ? 's' : ''}` : ''}
                      </small>
                    </span>
                    {st && <Chip v={st.v}>{st.label}</Chip>}
                  </div>
                );
              })}
              <div className="pc-ligne">
                <span className="pc-txt"><b>Total des métiers</b></span>
                <span className="pc-cote">{argent(totalMetiers)}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---------- Feuilles ---------- */}
      {feuille?.type === 'budget' && (
        <FeuilleBudget actuel={b.total} onFermer={fermer} onEnregistre={() => apresEnregistrement('Budget total mis à jour ✓')} />
      )}
      {feuille?.type === 'debourse' && (
        <FeuilleDebourse
          d={feuille.d}
          onFermer={fermer}
          onEnregistre={(t) => apresEnregistrement(t)}
          onSupprimer={demanderSuppressionDebourse}
        />
      )}
      {feuille?.type === 'paiement' && (
        <FeuillePaiement metiers={metiers} onFermer={fermer} onEnregistre={() => apresEnregistrement('Paiement ajouté ✓')} />
      )}
      {confirmation && (
        <Confirmer message={confirmation.message} onOui={confirmation.action} onNon={annulerConfirmation} />
      )}
    </>
  );
}

// ===================== Feuille : budget total =====================
// PATCH /chantier/project est réservé à l'administrateur (Martin). Pour Marie-Josée,
// le serveur répond 403 : on affiche son message dans la feuille.
function FeuilleBudget({ actuel, onFermer, onEnregistre }: { actuel: number; onFermer: () => void; onEnregistre: () => void }) {
  const [valeur, setValeur] = useState(actuel ? String(actuel) : '');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function enregistrer() {
    setOccupe(true); setErreur(null);
    try { await ChantierAPI.updateProject({ budgetTotal: lireMontant(valeur) }); onEnregistre(); }
    catch (e) { setErreur(msg(e)); setOccupe(false); }
  }
  return (
    <Feuille titre="Budget total du chantier" onFermer={onFermer}>
      <Champ id="pc-budget-total" label="Budget total ($)">
        <input id="pc-budget-total" inputMode="numeric" value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="ex. 420000" />
      </Champ>
      <Erreur message={erreur} />
      <div style={{ marginTop: erreur ? 10 : 0 }}>
        <button className="pc-btn" disabled={occupe} onClick={enregistrer}>{occupe ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </Feuille>
  );
}

// ===================== Feuille : déboursé banque (ajout / modification) =====================
function FeuilleDebourse({ d, onFermer, onEnregistre, onSupprimer }: {
  d: DebourseBanque | null;
  onFermer: () => void;
  onEnregistre: (toast: string) => void;
  onSupprimer: (d: DebourseBanque) => void;
}) {
  const [label, setLabel] = useState(d?.label || '');
  const [montant, setMontant] = useState(d ? String(d.amount || '') : '');
  const [datePrevue, setDatePrevue] = useState(versInputDate(d?.datePrevue));
  const [dateRecu, setDateRecu] = useState(versInputDate(d?.dateRecu));
  const [condition, setCondition] = useState(d?.condition || '');
  const [recu, setRecu] = useState(!!d?.recu);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    if (!label.trim()) { setErreur('Donne un nom au déboursé (ex. « Déboursé 2 — toit fermé »).'); return; }
    setOccupe(true); setErreur(null);
    try {
      if (d) {
        await ChantierAPI.updateDebourse(d.id, {
          label: label.trim(), amount: lireMontant(montant), condition: condition.trim() || null,
          datePrevue: datePrevue || null, recu,
          // Date de réception : seulement si reçu ; vide → le serveur met aujourd'hui.
          ...(recu && dateRecu ? { dateRecu } : {}),
        });
        onEnregistre('Déboursé banque modifié ✓');
      } else {
        await ChantierAPI.createDebourse({
          label: label.trim(), amount: lireMontant(montant),
          ...(datePrevue ? { datePrevue } : {}), ...(condition.trim() ? { condition: condition.trim() } : {}),
        });
        onEnregistre('Déboursé banque ajouté ✓');
      }
    } catch (e) { setErreur(msg(e)); setOccupe(false); }
  }

  return (
    <Feuille titre={d ? 'Modifier le déboursé banque' : 'Nouveau déboursé banque'} onFermer={onFermer}>
      <Champ id="pc-deb-label" label="Nom du déboursé">
        <input id="pc-deb-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Déboursé 1 — fondations coulées" />
      </Champ>
      <div className="pc-rangee" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Champ id="pc-deb-montant" label="Montant ($)">
            <input id="pc-deb-montant" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="ex. 95000" />
          </Champ>
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Champ id="pc-deb-date" label="Date prévue">
            <input id="pc-deb-date" type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} />
          </Champ>
        </div>
      </div>
      <Champ id="pc-deb-condition" label="Condition de la banque (optionnel)">
        <input id="pc-deb-condition" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="ex. inspection fondations + facture" />
      </Champ>
      {d && (
        <>
          <label className="pc-case" htmlFor="pc-deb-recu" style={{ marginBottom: 12 }}>
            <input id="pc-deb-recu" type="checkbox" checked={recu} onChange={(e) => setRecu(e.target.checked)} />
            <span>Reçu de la banque</span>
          </label>
          {recu && (
            <Champ id="pc-deb-daterecu" label="Date de réception (vide = aujourd'hui)">
              <input id="pc-deb-daterecu" type="date" value={dateRecu} onChange={(e) => setDateRecu(e.target.value)} />
            </Champ>
          )}
        </>
      )}
      <Erreur message={erreur} />
      <div className="pc-rangee" style={{ marginTop: 10 }}>
        <button className="pc-btn" style={{ flex: 1 }} disabled={occupe} onClick={enregistrer}>
          {occupe ? 'Enregistrement…' : d ? 'Enregistrer' : 'Ajouter le déboursé'}
        </button>
        {d && (
          <button className="pc-btn danger" style={{ flex: 1 }} disabled={occupe} onClick={() => onSupprimer(d)}>
            <Icone nom="trash" /> Supprimer
          </button>
        )}
      </div>
    </Feuille>
  );
}

// ===================== Feuille : nouveau paiement =====================
function FeuillePaiement({ metiers, onFermer, onEnregistre }: { metiers: Trade[]; onFermer: () => void; onEnregistre: () => void }) {
  const [label, setLabel] = useState('');
  const [montant, setMontant] = useState('');
  const [type, setType] = useState<DepenseType>('PARTIEL');
  const [tradeId, setTradeId] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    if (lireMontant(montant) <= 0) { setErreur('Indique le montant payé.'); return; }
    setOccupe(true); setErreur(null);
    try {
      await ChantierAPI.createDepense({
        amount: lireMontant(montant), type,
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(tradeId ? { tradeId: Number(tradeId) } : {}),
        ...(paidAt ? { paidAt } : {}), // vide → le serveur met aujourd'hui
      });
      onEnregistre();
    } catch (e) { setErreur(msg(e)); setOccupe(false); }
  }

  return (
    <Feuille titre="Ajouter un paiement" onFermer={onFermer}>
      <Champ id="pc-pai-label" label="Description">
        <input id="pc-pai-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Dépôt excavation" />
      </Champ>
      <div className="pc-rangee" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Champ id="pc-pai-montant" label="Montant ($)">
            <input id="pc-pai-montant" inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} />
          </Champ>
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <Champ id="pc-pai-type" label="Type">
            <select id="pc-pai-type" value={type} onChange={(e) => setType(e.target.value as DepenseType)}>
              {TYPES_PAIEMENT.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Champ>
        </div>
      </div>
      <Champ id="pc-pai-metier" label="Corps de métier (optionnel)">
        <select id="pc-pai-metier" value={tradeId} onChange={(e) => setTradeId(e.target.value)}>
          <option value="">— Aucun —</option>
          {metiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Champ>
      <Champ id="pc-pai-date" label="Date du paiement (vide = aujourd'hui)">
        <input id="pc-pai-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
      </Champ>
      <Erreur message={erreur} />
      <div style={{ marginTop: erreur ? 10 : 0 }}>
        <button className="pc-btn" disabled={occupe} onClick={enregistrer}>{occupe ? 'Enregistrement…' : 'Ajouter le paiement'}</button>
      </div>
    </Feuille>
  );
}
