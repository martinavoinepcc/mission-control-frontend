'use client';

// =====================================================================
// CONTACTS — écran 'contacts' (tuile « contacts »)
// ---------------------------------------------------------------------
// Porté de l'ancienne app Chantier (ContactsView + ContactFormModal).
// Liste groupée par métier ou par statut ; toucher un contact ouvre sa fiche
// (feuille du bas) : téléphone, courriel, site, Facebook, Instagram, adresse, RBQ.
// Le téléphone et le courriel sont AUSSI affichés en texte sélectionnable
// (+ bouton Copier) : les liens tel:/mailto: ne marchent pas sur tous les appareils.
//
// Routes API appelées (via lib/chantier-api.ts) :
//   GET    /chantier/contacts               liste (avec les soumissions de chaque contact)
//   POST   /chantier/contacts               ajouter (proprio)
//   PATCH  /chantier/contacts/:id           modifier (proprio)
//   DELETE /chantier/contacts/:id           supprimer (proprio, après Confirmer) ;
//                                           ses soumissions restent, sans contact rattaché
//
// Invité (proprio = false) : lecture seule. Les montants des soumissions d'un
// contact ne sont montrés que si la tuile « soumissions » est partagée.
// =====================================================================

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChantierAPI, type Contact, type ContactStatus } from '@/lib/chantier-api';
import {
  useChalet, Entete, Icone, Chip, Vide, Erreur, Chargement, Feuille, Confirmer, Champ,
  argent, type EcranProps,
} from '../_kit/ui';
import { msgErreur } from './Soumissions';

type V = 'ok' | 'warn' | 'bad' | 'info' | 'neutre';

const CONTACT_STATUT: Record<ContactStatus, { libelle: string; v: V }> = {
  PRESSENTI: { libelle: 'Pressenti', v: 'neutre' },
  SOUMISSION_RECUE: { libelle: 'Soumission reçue', v: 'warn' },
  RETENU: { libelle: 'Retenu', v: 'ok' },
  ECARTE: { libelle: 'Écarté', v: 'neutre' },
};
const ORDRE_STATUTS: ContactStatus[] = ['RETENU', 'SOUMISSION_RECUE', 'PRESSENTI', 'ECARTE'];

// Lien externe à partir de ce qui a été saisi (« taloplans.ca », « @page », URL complète).
function lienExterne(brut: string, reseau?: 'facebook' | 'instagram'): string {
  const v = brut.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (reseau && v.startsWith('@')) return `https://www.${reseau}.com/${v.slice(1)}`;
  if (reseau && !v.includes('.')) return `https://www.${reseau}.com/${v}`;
  return `https://${v}`;
}

// « (819) 538-3994 » → « +18195383994 »-like : on garde chiffres et « + » pour tel:.
function lienTel(tel: string): string {
  return `tel:${tel.replace(/[^\d+]/g, '')}`;
}

// ---------- Fiche d'un contact (feuille) ----------
function LigneInfo({ icone, libelle, valeur, children }: { icone: string; libelle: string; valeur: string; children?: ReactNode }) {
  return (
    <div className="pc-ligne">
      <span className="pc-pt pc-c-info" aria-hidden="true"><Icone nom={icone} /></span>
      <span className="pc-txt">
        <small>{libelle}</small>
        <b className="pc-cote" style={{ fontSize: 14, userSelect: 'text' }}>{valeur}</b>
      </span>
      {children}
    </div>
  );
}

function FicheContact({ c, onFermer, onModifier, onSupprimer }: {
  c: Contact;
  onFermer: () => void;
  onModifier: () => void;
  onSupprimer: () => void;
}) {
  const { proprio, peutVoir, toast } = useChalet();
  const st = CONTACT_STATUT[c.status] || CONTACT_STATUT.PRESSENTI;
  const voitMontants = proprio || peutVoir('soumissions');
  const soums = c.soumissions || [];
  const acceptee = soums.find((s) => s.status === 'ACCEPTEE');

  async function copier(texte: string, quoi: string) {
    try {
      await navigator.clipboard.writeText(texte);
      toast(`${quoi} copié`);
    } catch {
      toast('Copie impossible : sélectionne le texte à la main');
    }
  }

  return (
    <Feuille titre={c.company} onFermer={onFermer}>
      <div className="pc-rangee" style={{ marginTop: -4, marginBottom: 12 }}>
        <Chip v={st.v}>{st.libelle}</Chip>
        {[c.person, c.trade].filter(Boolean).length > 0 && (
          <span className="pc-muted pc-petit">{[c.person, c.trade].filter(Boolean).join(' · ')}</span>
        )}
      </div>

      <div className="pc-liste">
        {c.phone && (
          <LigneInfo icone="phone" libelle="Téléphone" valeur={c.phone}>
            <a className="pc-icobtn" href={lienTel(c.phone)} aria-label={`Appeler ${c.company}`}><Icone nom="phone" /></a>
            <button className="pc-icobtn" onClick={() => copier(c.phone || '', 'Numéro')} aria-label="Copier le numéro"><Icone nom="copy" /></button>
          </LigneInfo>
        )}
        {c.email && (
          <LigneInfo icone="envelope" libelle="Courriel" valeur={c.email}>
            <a className="pc-icobtn" href={`mailto:${c.email}`} aria-label={`Écrire à ${c.company}`}><Icone nom="paper-plane" /></a>
            <button className="pc-icobtn" onClick={() => copier(c.email || '', 'Courriel')} aria-label="Copier le courriel"><Icone nom="copy" /></button>
          </LigneInfo>
        )}
        {c.website && (
          <LigneInfo icone="globe" libelle="Site web" valeur={c.website}>
            <a className="pc-icobtn" href={lienExterne(c.website)} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le site web"><Icone nom="up-right-from-square" /></a>
          </LigneInfo>
        )}
        {c.facebook && (
          <LigneInfo icone="share-nodes" libelle="Facebook" valeur={c.facebook}>
            <a className="pc-icobtn" href={lienExterne(c.facebook, 'facebook')} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir la page Facebook"><Icone nom="up-right-from-square" /></a>
          </LigneInfo>
        )}
        {c.instagram && (
          <LigneInfo icone="camera" libelle="Instagram" valeur={c.instagram}>
            <a className="pc-icobtn" href={lienExterne(c.instagram, 'instagram')} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le compte Instagram"><Icone nom="up-right-from-square" /></a>
          </LigneInfo>
        )}
        {c.address && (
          <LigneInfo icone="location-dot" libelle="Adresse" valeur={c.address}>
            <a className="pc-icobtn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`} target="_blank" rel="noopener noreferrer" aria-label="Voir l'adresse sur la carte"><Icone nom="map-location-dot" /></a>
          </LigneInfo>
        )}
        {c.rbq && <LigneInfo icone="id-card" libelle="Licence RBQ" valeur={c.rbq} />}
        {!c.phone && !c.email && !c.website && !c.facebook && !c.instagram && !c.address && !c.rbq && (
          <Vide>Aucune coordonnée enregistrée.</Vide>
        )}
      </div>

      {soums.length > 0 && (
        <p className="pc-petit pc-muted" style={{ marginBottom: 0 }}>
          {soums.length} soumission{soums.length > 1 ? 's' : ''}
          {voitMontants && acceptee ? ` · acceptée : ${argent(acceptee.amount)}` : ''}
        </p>
      )}
      {c.notes && <div className="pc-carte" style={{ marginTop: 10, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{c.notes}</div>}

      {proprio && (
        <div className="pc-rangee" style={{ marginTop: 14 }}>
          <button className="pc-btn" style={{ flex: 1 }} onClick={onModifier}><Icone nom="pen" /> Modifier</button>
          <button className="pc-btn danger" style={{ flex: 1 }} onClick={onSupprimer}><Icone nom="trash" /> Supprimer</button>
        </div>
      )}
    </Feuille>
  );
}

// ---------- Formulaire contact : ajouter (contact = null) ou modifier (proprio) ----------
function FeuilleContact({ contact, onFermer, onEnregistre }: {
  contact: Contact | null;
  onFermer: () => void;
  onEnregistre: () => void | Promise<void>;
}) {
  const [f, setF] = useState({
    company: contact?.company || '',
    person: contact?.person || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    website: contact?.website || '',
    facebook: contact?.facebook || '',
    instagram: contact?.instagram || '',
    address: contact?.address || '',
    rbq: contact?.rbq || '',
    trade: contact?.trade || '',
    notes: contact?.notes || '',
  });
  const [statut, setStatut] = useState<ContactStatus>(contact?.status || 'PRESSENTI');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  type Cle = keyof typeof f;
  const champ = (cle: Cle, label: string, extra?: { placeholder?: string; inputMode?: 'tel' | 'email' | 'url' }) => (
    <Champ id={`fc-${cle}`} label={label}>
      <input
        id={`fc-${cle}`}
        value={f[cle]}
        onChange={(e) => setF((x) => ({ ...x, [cle]: e.target.value }))}
        placeholder={extra?.placeholder}
        inputMode={extra?.inputMode}
        type={extra?.inputMode === 'email' ? 'email' : extra?.inputMode === 'tel' ? 'tel' : 'text'}
      />
    </Champ>
  );

  async function enregistrer() {
    if (!f.company.trim()) { setErreur("Le nom de l'entreprise est requis."); return; }
    setOccupe(true);
    setErreur(null);
    // Champs vides → null (le backend efface la valeur).
    const corps: Partial<Contact> = {
      company: f.company.trim(),
      person: f.person.trim() || null,
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      website: f.website.trim() || null,
      facebook: f.facebook.trim() || null,
      instagram: f.instagram.trim() || null,
      address: f.address.trim() || null,
      rbq: f.rbq.trim() || null,
      trade: f.trade.trim() || null,
      notes: f.notes.trim() || null,
      status: statut,
    };
    try {
      if (contact) await ChantierAPI.updateContact(contact.id, corps);
      else await ChantierAPI.createContact(corps);
      await onEnregistre();
    } catch (e) {
      setErreur(msgErreur(e));
      setOccupe(false);
    }
  }

  return (
    <Feuille titre={contact ? 'Modifier le contact' : 'Nouveau contact'} onFermer={onFermer}>
      {champ('company', 'Entreprise')}
      {champ('person', 'Personne contact')}
      {champ('trade', 'Métier', { placeholder: 'ex. Plombier' })}
      {champ('phone', 'Téléphone', { inputMode: 'tel' })}
      {champ('email', 'Courriel', { inputMode: 'email' })}
      {champ('website', 'Site web', { inputMode: 'url', placeholder: 'ex. entreprise.ca' })}
      {champ('facebook', 'Facebook', { placeholder: 'lien ou @page' })}
      {champ('instagram', 'Instagram', { placeholder: 'lien ou @compte' })}
      {champ('address', 'Adresse', { placeholder: 'ex. 123 rue Principale, Shawinigan' })}
      {champ('rbq', 'Licence RBQ', { placeholder: 'ex. 5678-1234-01' })}
      <Champ id="fc-statut" label="Statut">
        <select id="fc-statut" value={statut} onChange={(e) => setStatut(e.target.value as ContactStatus)}>
          {ORDRE_STATUTS.map((s) => <option key={s} value={s}>{CONTACT_STATUT[s].libelle}</option>)}
        </select>
      </Champ>
      <Champ id="fc-notes" label="Notes">
        <textarea id="fc-notes" value={f.notes} onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))} />
      </Champ>
      <Erreur message={erreur} />
      <button className="pc-btn" style={{ marginTop: 10 }} disabled={occupe} onClick={enregistrer}>
        {occupe ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </Feuille>
  );
}

// ---------- Écran ----------
type EtatFeuille =
  | null
  | { t: 'fiche'; c: Contact }
  | { t: 'form'; c: Contact | null }
  | { t: 'supprimer'; c: Contact };

type Groupe = { cle: string; titre: string; liste: Contact[] };

export default function Contacts(_: EcranProps) {
  const { toast, proprio } = useChalet();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<'metier' | 'statut'>('metier');
  const [feuille, setFeuille] = useState<EtatFeuille>(null);

  const charger = useCallback(async () => {
    try {
      setContacts((await ChantierAPI.contacts()).contacts);
      setErreur(null);
    } catch (e) {
      setErreur(msgErreur(e));
    }
  }, []);
  useEffect(() => { charger(); }, [charger]);
  const fermer = useCallback(() => setFeuille(null), []);

  const groupes: Groupe[] = useMemo(() => {
    const liste = contacts || [];
    if (vue === 'statut') {
      return ORDRE_STATUTS
        .map((s) => ({ cle: s, titre: CONTACT_STATUT[s].libelle, liste: liste.filter((c) => (c.status || 'PRESSENTI') === s) }))
        .filter((g) => g.liste.length > 0);
    }
    const m = new Map<string, Groupe>();
    for (const c of liste) {
      const titre = c.trade?.trim() || 'Sans métier';
      const cle = titre.toLowerCase();
      const g = m.get(cle) || { cle, titre, liste: [] };
      g.liste.push(c);
      m.set(cle, g);
    }
    return [...m.values()].sort((a, b) => {
      if (a.titre === 'Sans métier') return 1;
      if (b.titre === 'Sans métier') return -1;
      return a.titre.localeCompare(b.titre, 'fr');
    });
  }, [contacts, vue]);

  return (
    <>
      <Entete
        titre="Contacts"
        actions={proprio ? (
          <button className="pc-icobtn" onClick={() => setFeuille({ t: 'form', c: null })} aria-label="Ajouter un contact">
            <Icone nom="plus" />
          </button>
        ) : undefined}
      />

      <div className="pc-segment" role="group" aria-label="Grouper les contacts">
        <button className={vue === 'metier' ? 'on' : ''} aria-pressed={vue === 'metier'} onClick={() => setVue('metier')}>Par métier</button>
        <button className={vue === 'statut' ? 'on' : ''} aria-pressed={vue === 'statut'} onClick={() => setVue('statut')}>Par statut</button>
      </div>

      <Erreur message={erreur} />
      {!contacts && !erreur && <Chargement />}
      {contacts && contacts.length === 0 && (
        <Vide>Aucun contact.{proprio ? ' Ajoute ton premier fournisseur avec le +.' : ''}</Vide>
      )}

      {groupes.map((g) => (
        <section key={g.cle}>
          <div className="pc-section-titre"><h3>{g.titre}</h3><span className="pc-petit pc-muted">{g.liste.length}</span></div>
          <div className="pc-liste">
            {g.liste.map((c) => {
              const st = CONTACT_STATUT[c.status] || CONTACT_STATUT.PRESSENTI;
              const sous = [c.person, vue === 'statut' ? c.trade : null, c.phone].filter(Boolean).join(' · ');
              return (
                <button key={c.id} className="pc-ligne" onClick={() => setFeuille({ t: 'fiche', c })}>
                  <span className="pc-pt pc-c-info"><Icone nom="user-tie" /></span>
                  <span className="pc-txt"><b>{c.company}</b>{sous && <small>{sous}</small>}</span>
                  {vue === 'metier' && <Chip v={st.v}>{st.libelle}</Chip>}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {feuille?.t === 'fiche' && (
        <FicheContact
          c={feuille.c}
          onFermer={fermer}
          onModifier={() => setFeuille({ t: 'form', c: feuille.c })}
          onSupprimer={() => setFeuille({ t: 'supprimer', c: feuille.c })}
        />
      )}
      {proprio && feuille?.t === 'form' && (
        <FeuilleContact
          contact={feuille.c}
          onFermer={fermer}
          onEnregistre={async () => { setFeuille(null); toast('Contact enregistré'); await charger(); }}
        />
      )}
      {proprio && feuille?.t === 'supprimer' && (
        <Confirmer
          message={`Supprimer « ${feuille.c.company} » ? Ses soumissions sont conservées, sans contact rattaché.`}
          onNon={fermer}
          onOui={async () => {
            try {
              await ChantierAPI.deleteContact(feuille.c.id);
              setFeuille(null);
              toast('Contact supprimé');
              await charger();
            } catch (e) {
              setFeuille(null);
              setErreur(msgErreur(e));
            }
          }}
        />
      )}
    </>
  );
}
