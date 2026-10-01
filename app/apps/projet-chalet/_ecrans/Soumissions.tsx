'use client';

// =====================================================================
// SOUMISSIONS — écran 'soumissions' (tuile « soumissions », privée par défaut)
// ---------------------------------------------------------------------
// Porté de l'ancienne app Chantier (SoumissionsView + SoumissionFormModal).
// Comparateur : les soumissions sont groupées par item (jalon, sinon corps de
// métier, sinon libellé) ; dans chaque groupe on affiche « n/3 prix » et
// l'étoile « ★ Meilleur prix » sur le plus bas montant non refusé.
//
// Routes API appelées (via lib/chantier-api.ts) :
//   GET    /chantier/soumissions            liste (triée par montant croissant)
//   PATCH  /chantier/soumissions/:id        accepter / refuser (status)
//          → accepter fixe le budget du métier, marque le contact RETENU et
//            refuse automatiquement les autres soumissions du même jalon (backend).
//   DELETE /chantier/soumissions/:id        supprimer (proprio, après Confirmer)
//   POST   /chantier/soumissions            ajouter (proprio, FeuilleSoumission)
//   GET    /chantier/contacts, /chantier/jalons, /chantier/trades
//          → listes déroulantes du formulaire (proprio seulement)
//   POST   /chantier/contacts               « nouveau contact » créé depuis le formulaire
//
// Invité (proprio = false) : lecture seule, aucun bouton d'écriture.
// Exporte aussi FeuilleSoumission, CarteSoumission, SOUM_STATUT et
// meilleurPrix, réutilisés par la fiche jalon (Jalons.tsx).
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChantierAPI,
  type Soumission, type SoumissionStatus, type Contact, type JalonLite, type Trade,
} from '@/lib/chantier-api';
import {
  useChalet, Entete, Icone, Chip, Vide, Erreur, Chargement, Feuille, Confirmer, Champ,
  argent, dateCourte, type EcranProps,
} from '../_kit/ui';

type V = 'ok' | 'warn' | 'bad' | 'info' | 'neutre';

export const SOUM_STATUT: Record<SoumissionStatus, { libelle: string; v: V }> = {
  RECUE: { libelle: 'Reçue', v: 'info' },
  EN_ANALYSE: { libelle: 'En analyse', v: 'warn' },
  ACCEPTEE: { libelle: 'Acceptée', v: 'ok' },
  REFUSEE: { libelle: 'Refusée', v: 'neutre' },
};

export function msgErreur(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Erreur inattendue.';
}

// « 12 500,50 » → 12501 (le backend stocke des dollars entiers). null si invalide.
export function versMontant(s: string): number | null {
  const t = s.replace(/[\s$ ]/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

// Plus bas montant parmi les soumissions non refusées (> 0). null si aucune.
export function meilleurPrix(liste: Soumission[]): number | null {
  const vals = liste.filter((s) => s.status !== 'REFUSEE' && s.amount > 0).map((s) => s.amount);
  return vals.length ? Math.min(...vals) : null;
}

// ---------- Carte d'une soumission (liste + fiche jalon) ----------
export function CarteSoumission({ s, meilleur, sousTitre, proprio, occupe, onAccepter, onRefuser, onSupprimer }: {
  s: Soumission;
  meilleur: boolean;
  sousTitre: string;
  proprio: boolean;
  occupe?: boolean;
  onAccepter: () => void;
  onRefuser: () => void;
  onSupprimer?: () => void;
}) {
  const st = SOUM_STATUT[s.status] || SOUM_STATUT.RECUE;
  const nom = s.contact?.company || s.label || 'Soumission';
  return (
    <div className="pc-carte">
      <div className="pc-rangee" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ overflowWrap: 'anywhere' }}>{nom}</b>
          <div className="pc-petit pc-muted" style={{ overflowWrap: 'anywhere' }}>{sousTitre || '—'}</div>
        </div>
        <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
          <div className="pc-cote" style={{ fontSize: 15, fontWeight: 700 }}>{argent(s.amount)}</div>
          <Chip v={st.v}>{st.libelle}</Chip>
        </div>
      </div>
      {meilleur && <div style={{ marginTop: 6 }}><Chip v="ok"><Icone nom="star" /> Meilleur prix</Chip></div>}
      {s.notes && <div className="pc-petit pc-muted" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>{s.notes}</div>}
      {proprio && (
        <div className="pc-rangee" style={{ marginTop: 8 }}>
          {s.status !== 'ACCEPTEE' && (
            <button className="pc-btn petit" disabled={occupe} onClick={onAccepter}>
              <Icone nom="check" /> Accepter
            </button>
          )}
          {s.status !== 'REFUSEE' && (
            <button className="pc-btn petit second" disabled={occupe} onClick={onRefuser}>
              <Icone nom="xmark" /> Refuser
            </button>
          )}
          {onSupprimer && (
            <button className="pc-btn petit danger" disabled={occupe} onClick={onSupprimer} aria-label={`Supprimer la soumission de ${nom}`}>
              <Icone nom="trash" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Formulaire : nouvelle soumission (proprio) ----------
// jalonFixe : la soumission est rattachée d'office à ce jalon (depuis la fiche jalon).
export function FeuilleSoumission({ jalonFixe, onFermer, onEnregistre }: {
  jalonFixe?: number;
  onFermer: () => void;
  onEnregistre: () => void | Promise<void>;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jalons, setJalons] = useState<JalonLite[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [contactId, setContactId] = useState('');
  const [nouveauContact, setNouveauContact] = useState('');
  const [label, setLabel] = useState('');
  const [montant, setMontant] = useState('');
  const [jalonId, setJalonId] = useState(jalonFixe ? String(jalonFixe) : '');
  const [tradeId, setTradeId] = useState('');
  const [recue, setRecue] = useState('');
  const [notes, setNotes] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Listes déroulantes : chargées une fois à l'ouverture. Un échec n'empêche pas de saisir.
  useEffect(() => {
    ChantierAPI.contacts().then((r) => setContacts(r.contacts)).catch(() => {});
    ChantierAPI.trades().then((r) => setTrades(r.trades)).catch(() => {});
    if (!jalonFixe) ChantierAPI.jalons().then((r) => setJalons(r.jalons)).catch(() => {});
  }, [jalonFixe]);

  async function enregistrer() {
    const amount = versMontant(montant);
    if (amount === null) { setErreur('Entre un montant valide (ex. 12500).'); return; }
    if (!contactId && !nouveauContact.trim() && !label.trim()) {
      setErreur('Choisis un contact, ou donne au moins un nom d\'entreprise ou un item.');
      return;
    }
    setOccupe(true);
    setErreur(null);
    try {
      let cid: number | null = contactId ? Number(contactId) : null;
      if (!cid && nouveauContact.trim()) {
        const { contact } = await ChantierAPI.createContact({ company: nouveauContact.trim(), status: 'SOUMISSION_RECUE' });
        cid = contact.id;
      }
      await ChantierAPI.createSoumission({
        amount,
        contactId: cid,
        label: label.trim() || null,
        notes: notes.trim() || null,
        receivedAt: recue || null,
        jalonId: jalonId ? Number(jalonId) : null,
        tradeId: tradeId ? Number(tradeId) : null,
      });
      await onEnregistre();
    } catch (e) {
      setErreur(msgErreur(e));
      setOccupe(false);
    }
  }

  return (
    <Feuille titre="Nouvelle soumission" onFermer={onFermer}>
      <Champ id="fs-contact" label="Contact existant">
        <select id="fs-contact" value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">— Nouveau / aucun —</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.company}{c.person ? ` (${c.person})` : ''}</option>)}
        </select>
      </Champ>
      {!contactId && (
        <Champ id="fs-nouveau" label="…ou nouveau contact (entreprise)">
          <input id="fs-nouveau" value={nouveauContact} onChange={(e) => setNouveauContact(e.target.value)} placeholder="ex. Excavation Mékinac" />
        </Champ>
      )}
      <Champ id="fs-label" label="Item (optionnel)">
        <input id="fs-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Génératrice" />
      </Champ>
      <Champ id="fs-montant" label="Montant ($)">
        <input id="fs-montant" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="ex. 12500" />
      </Champ>
      {!jalonFixe && (
        <Champ id="fs-jalon" label="Rattacher à un jalon (optionnel)">
          <select id="fs-jalon" value={jalonId} onChange={(e) => setJalonId(e.target.value)}>
            <option value="">— Aucun —</option>
            {jalons.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </Champ>
      )}
      <Champ id="fs-trade" label="Corps de métier (optionnel)">
        <select id="fs-trade" value={tradeId} onChange={(e) => setTradeId(e.target.value)}>
          <option value="">— Aucun —</option>
          {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Champ>
      <Champ id="fs-recue" label="Reçue le (optionnel, aujourd'hui par défaut)">
        <input id="fs-recue" type="date" value={recue} onChange={(e) => setRecue(e.target.value)} />
      </Champ>
      <Champ id="fs-notes" label="Notes">
        <textarea id="fs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Champ>
      <Erreur message={erreur} />
      <button className="pc-btn" style={{ marginTop: 10 }} disabled={occupe} onClick={enregistrer}>
        {occupe ? 'Enregistrement…' : 'Ajouter la soumission'}
      </button>
    </Feuille>
  );
}

// ---------- Groupement par item ----------
type Groupe = { cle: string; titre: string; liste: Soumission[] };

function grouper(soumissions: Soumission[]): Groupe[] {
  const m = new Map<string, Groupe>();
  for (const s of soumissions) {
    let cle = 'aucun';
    let titre = 'Sans item';
    if (s.jalon) { cle = `j${s.jalon.id}`; titre = s.jalon.name; }
    else if (s.trade) { cle = `t${s.trade.id}`; titre = s.trade.name; }
    else if (s.label) { cle = `l:${s.label.trim().toLowerCase()}`; titre = s.label.trim(); }
    const g = m.get(cle) || { cle, titre, liste: [] };
    g.liste.push(s);
    m.set(cle, g);
  }
  return [...m.values()].sort((a, b) => {
    if (a.cle === 'aucun') return 1;
    if (b.cle === 'aucun') return -1;
    return a.titre.localeCompare(b.titre, 'fr');
  });
}

// Sous-titre d'une carte : ce qui n'a pas servi au groupement.
function sousTitre(s: Soumission, cleGroupe: string): string {
  return [
    s.contact?.person,
    cleGroupe.startsWith('j') ? s.trade?.name : null,
    !cleGroupe.startsWith('l:') && s.contact?.company ? s.label : null,
    s.receivedAt ? `reçue ${dateCourte(s.receivedAt)}` : null,
  ].filter(Boolean).join(' · ');
}

// ---------- Écran ----------
export default function Soumissions(_: EcranProps) {
  const { toast, proprio } = useChalet();
  const [soumissions, setSoumissions] = useState<Soumission[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<number | null>(null);
  const [ajout, setAjout] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Soumission | null>(null);

  const charger = useCallback(async () => {
    try {
      setSoumissions((await ChantierAPI.soumissions()).soumissions);
      setErreur(null);
    } catch (e) {
      setErreur(msgErreur(e));
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const fermerAjout = useCallback(() => setAjout(false), []);
  const groupes = useMemo(() => grouper(soumissions || []), [soumissions]);

  async function changerStatut(s: Soumission, status: SoumissionStatus) {
    setOccupe(s.id);
    try {
      await ChantierAPI.updateSoumission(s.id, { status });
      toast(status === 'ACCEPTEE'
        ? (s.jalonId ? 'Soumission acceptée — les autres du jalon sont refusées' : 'Soumission acceptée')
        : 'Soumission refusée');
      await charger();
    } catch (e) {
      setErreur(msgErreur(e));
    } finally {
      setOccupe(null);
    }
  }

  return (
    <>
      <Entete
        titre="Soumissions"
        actions={proprio ? (
          <button className="pc-icobtn" onClick={() => setAjout(true)} aria-label="Ajouter une soumission">
            <Icone nom="plus" />
          </button>
        ) : undefined}
      />
      <Erreur message={erreur} />

      {!soumissions && !erreur && <Chargement />}
      {soumissions && soumissions.length === 0 && (
        <Vide>Aucune soumission pour l'instant.{proprio ? ' Ajoute la première avec le +.' : ''}</Vide>
      )}

      {groupes.map((g) => {
        const min = meilleurPrix(g.liste);
        const nbPrix = g.liste.filter((s) => s.status !== 'REFUSEE').length;
        return (
          <section key={g.cle}>
            <div className="pc-section-titre">
              <h3>{g.titre}</h3>
              <span className="pc-petit pc-muted">{nbPrix}/3 prix</span>
            </div>
            {g.liste.map((s) => (
              <CarteSoumission
                key={s.id}
                s={s}
                meilleur={min !== null && s.amount === min && s.status !== 'REFUSEE'}
                sousTitre={sousTitre(s, g.cle)}
                proprio={proprio}
                occupe={occupe === s.id}
                onAccepter={() => changerStatut(s, 'ACCEPTEE')}
                onRefuser={() => changerStatut(s, 'REFUSEE')}
                onSupprimer={() => setASupprimer(s)}
              />
            ))}
          </section>
        );
      })}

      {proprio && ajout && (
        <FeuilleSoumission
          onFermer={fermerAjout}
          onEnregistre={async () => { setAjout(false); toast('Soumission ajoutée'); await charger(); }}
        />
      )}

      {proprio && aSupprimer && (
        <Confirmer
          message={`Supprimer la soumission de ${aSupprimer.contact?.company || aSupprimer.label || 'ce fournisseur'} (${argent(aSupprimer.amount)}) ? Cette action est définitive.`}
          onNon={() => setASupprimer(null)}
          onOui={async () => {
            try {
              await ChantierAPI.deleteSoumission(aSupprimer.id);
              setASupprimer(null);
              toast('Soumission supprimée');
              await charger();
            } catch (e) {
              setASupprimer(null);
              setErreur(msgErreur(e));
            }
          }}
        />
      )}
    </>
  );
}
