'use client';

// MOI — mon profil dans le projet + (propriétaires) les invités et les liens partagés.
//
// Invités : visibilité choisie TUILE PAR TUILE (décision Martin 2026-10-01, pas de rôles imposés).
// Inviter = créer un code à usage unique ; l'invité ouvre /invitation/?code=… et se crée
// un compte (profil GUEST, lecture seule, seulement les tuiles cochées).
// Routes : GET/POST /projet-chalet/membres, PUT /membres/:id/tuiles, PATCH /membres/:id,
//          GET /partages, DELETE /partages/:id.

import { useCallback, useEffect, useState } from 'react';
import { ProjetChaletAPI, type Invite, type Partage, type Section } from '@/lib/projet-chalet-api';
import { useChalet, Icone, Chip, Vide, Erreur, Chargement, Feuille, Confirmer, Champ, EnteteSimple, dateCourte, type EcranProps } from '../_kit/ui';

const SITE = 'https://my-mission-control.com';

// Copie dans le presse-papier ; si refusé, on sélectionne le texte pour copie manuelle.
async function copier(texte: string, champId: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    const el = document.getElementById(champId) as HTMLInputElement | null;
    el?.select();
    return false;
  }
}

// Cases à cocher : une par tuile. Les tuiles « privées » (Budget, Soumissions) sont décochées par défaut.
function CasesTuiles({ sections, coches, onChange }: { sections: Section[]; coches: string[]; onChange: (s: string[]) => void }) {
  return (
    <div className="pc-liste">
      {sections.map((s) => (
        <label key={s.slug} className="pc-ligne pc-case" htmlFor={`tuile-${s.slug}`} style={{ cursor: 'pointer' }}>
          <span className="pc-pt" style={{ background: s.couleur, color: '#fff' }}><Icone nom={s.icone} /></span>
          <span className="pc-txt"><b>{s.nom}</b><small>{s.prive ? 'Privée par défaut' : s.aide}</small></span>
          <input
            type="checkbox"
            id={`tuile-${s.slug}`}
            checked={coches.includes(s.slug)}
            onChange={(e) => onChange(e.target.checked ? [...coches, s.slug] : coches.filter((x) => x !== s.slug))}
          />
        </label>
      ))}
    </div>
  );
}

export default function Moi(_: EcranProps) {
  const { accueil, proprio, toast } = useChalet();
  const sections = accueil?.sections || [];
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [proprios, setProprios] = useState<string[]>([]);
  const [partages, setPartages] = useState<Partage[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [inviter, setInviter] = useState(false);
  const [nom, setNom] = useState('');
  const [detail, setDetail] = useState('');
  const [coches, setCoches] = useState<string[]>([]);
  const [nouveauCode, setNouveauCode] = useState<{ nom: string; code: string } | null>(null);
  const [edition, setEdition] = useState<Invite | null>(null);
  const [aRetirer, setARetirer] = useState<Invite | null>(null);

  const charger = useCallback(async () => {
    if (!proprio) return;
    try {
      const [m, p] = await Promise.all([ProjetChaletAPI.membres(), ProjetChaletAPI.partages()]);
      setInvites(m.invites);
      setProprios(m.proprietaires.map((x) => (x.nom === 'Marie-Josée' ? 'Marie-Josée' : x.nom)));
      setPartages(p.partages.filter((x) => !x.revoque && new Date(x.expireLe) > new Date()));
    } catch (e: any) {
      setErreur(e?.message || 'Erreur de chargement.');
    }
  }, [proprio]);
  useEffect(() => { charger(); }, [charger]);

  function ouvrirInvitation() {
    setNom(''); setDetail('');
    setCoches(sections.filter((s) => !s.prive).map((s) => s.slug));
    setInviter(true);
  }

  async function creerInvitation() {
    if (!nom.trim()) return;
    try {
      const r = await ProjetChaletAPI.inviter({ nom: nom.trim(), detail: detail.trim() || undefined, tuiles: coches });
      setInviter(false);
      setNouveauCode({ nom: r.membre.nom, code: r.membre.code });
      await charger();
    } catch (e: any) {
      setErreur(e?.message || "Impossible de créer l'invitation.");
    }
  }

  async function enregistrerTuiles() {
    if (!edition) return;
    try {
      await ProjetChaletAPI.tuilesMembre(edition.id, coches);
      toast(`Accès de ${edition.nom} enregistrés`);
      setEdition(null);
      await charger();
    } catch (e: any) {
      setErreur(e?.message || 'Enregistrement impossible.');
    }
  }

  const lienInvitation = (code: string) => `${SITE}/invitation/?code=${encodeURIComponent(code)}`;
  const nomTuiles = (slugs: string[]) => sections.filter((s) => slugs.includes(s.slug)).map((s) => s.nom).join(', ') || 'aucune';

  return (
    <>
      <EnteteSimple titre="Moi" />
      <div className="pc-liste">
        <div className="pc-ligne">
          <span className="pc-pt pc-c-ok"><Icone nom="circle-user" /></span>
          <span className="pc-txt"><b>{accueil?.moi.nom}</b><small>{proprio ? 'Propriétaire : tu vois tout' : `Invité : ${nomTuiles(sections.map((s) => s.slug))}`}</small></span>
        </div>
        <a className="pc-ligne" href="/dashboard/">
          <span className="pc-pt pc-c-neutre"><Icone nom="grip" /></span>
          <span className="pc-txt"><b>Retour au portail</b></span>
          <Icone nom="chevron-right" />
        </a>
        {!proprio && (
          <button className="pc-ligne" onClick={() => { localStorage.removeItem('mc_token'); window.location.href = '/'; }}>
            <span className="pc-pt pc-c-neutre"><Icone nom="right-from-bracket" /></span>
            <span className="pc-txt"><b>Me déconnecter</b></span>
          </button>
        )}
      </div>

      <Erreur message={erreur} />

      {proprio && (
        <>
          <div className="pc-section-titre"><h3>Propriétaires</h3></div>
          <p className="pc-muted pc-petit" style={{ marginTop: -4 }}>{proprios.join(' et ') || '…'} : accès complet.</p>

          <div className="pc-section-titre"><h3>Invités et leurs tuiles</h3></div>
          {!invites ? <Chargement /> : invites.length === 0 ? <Vide>Aucun invité. Invite l'entrepreneur, la designer… et choisis tuile par tuile ce qu'ils voient.</Vide> : (
            <div className="pc-liste">
              {invites.map((m) => (
                <button key={m.id} className="pc-ligne" onClick={() => { setEdition(m); setCoches(m.tuiles); }}>
                  <span className={`pc-pt ${m.actif ? 'pc-c-info' : 'pc-c-neutre'}`}><Icone nom={m.actif ? 'user-lock' : 'user-xmark'} /></span>
                  <span className="pc-txt">
                    <b>{m.nom}{m.detail ? ` · ${m.detail}` : ''}</b>
                    <small>{m.actif ? `${m.tuiles.length} tuile${m.tuiles.length > 1 ? 's' : ''} : ${nomTuiles(m.tuiles)}` : 'Accès retiré'}</small>
                  </span>
                  {!m.compteCree && m.actif && <Chip v="warn">Code non utilisé</Chip>}
                  <Icone nom="pen" />
                </button>
              ))}
            </div>
          )}
          <button className="pc-btn" style={{ marginTop: 10 }} onClick={ouvrirInvitation}><Icone nom="user-plus" /> Inviter quelqu'un</button>

          {partages.length > 0 && (
            <>
              <div className="pc-section-titre"><h3>Liens partagés actifs</h3></div>
              <div className="pc-liste">
                {partages.map((l) => (
                  <div key={l.id} className="pc-ligne">
                    <span className="pc-pt pc-c-info"><Icone nom="link" /></span>
                    <span className="pc-txt"><b>{l.titre}</b><small>Expire le {dateCourte(l.expireLe)} · vu {l.vues} fois</small></span>
                    <button className="pc-lien" onClick={async () => {
                      try { await ProjetChaletAPI.revoquerPartage(l.id); toast('Lien désactivé'); await charger(); } catch (e: any) { setErreur(e?.message || 'Impossible.'); }
                    }}>Désactiver</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {inviter && (
        <Feuille titre="Inviter quelqu'un" onFermer={() => setInviter(false)}>
          <Champ id="inv-nom" label="Nom"><input id="inv-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Électricien Lavoie" /></Champ>
          <Champ id="inv-detail" label="C'est qui ? (facultatif)"><input id="inv-detail" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Ex. : Électricien" /></Champ>
          <div className="pc-surtitre" style={{ marginBottom: 6 }}>Ce qu'il voit — coche tuile par tuile</div>
          <CasesTuiles sections={sections} coches={coches} onChange={setCoches} />
          <p className="pc-muted pc-petit">Les invités sont en lecture seule. Ils peuvent seulement déposer dans la boîte de dépôt.</p>
          <button className="pc-btn" onClick={creerInvitation} disabled={!nom.trim()}><Icone nom="ticket" /> Créer le code d'invitation</button>
        </Feuille>
      )}

      {nouveauCode && (
        <Feuille titre={`Invitation pour ${nouveauCode.nom}`} onFermer={() => setNouveauCode(null)}>
          <p style={{ marginTop: 0 }}>Envoie-lui ce lien. Il choisira son nom d'utilisateur et son mot de passe. Le code ne sert qu'une fois.</p>
          <Champ id="inv-lien" label="Lien d'invitation">
            <input id="inv-lien" readOnly value={lienInvitation(nouveauCode.code)} onFocus={(e) => e.currentTarget.select()} />
          </Champ>
          <p className="pc-cote" style={{ marginTop: -4 }}>Code : {nouveauCode.code}</p>
          <button className="pc-btn" onClick={async () => { toast((await copier(lienInvitation(nouveauCode.code), 'inv-lien')) ? 'Lien copié' : 'Sélectionné : copie-le manuellement'); }}>
            <Icone nom="copy" /> Copier le lien
          </button>
        </Feuille>
      )}

      {edition && (
        <Feuille titre={`Ce que voit ${edition.nom}`} onFermer={() => setEdition(null)}>
          {!edition.compteCree && edition.code && edition.actif && (
            <div className="pc-alerte" style={{ marginBottom: 10 }}>
              <Icone nom="ticket" /> Pas encore inscrit — lien : <span className="pc-cote" style={{ overflowWrap: 'anywhere' }}>{lienInvitation(edition.code)}</span>
            </div>
          )}
          <p className="pc-muted pc-petit" style={{ marginTop: 0 }}>Coche ou décoche. Ça s'applique tout de suite.</p>
          <CasesTuiles sections={sections} coches={coches} onChange={setCoches} />
          <div className="pc-rangee" style={{ marginTop: 12 }}>
            <button className="pc-btn" style={{ flex: 1 }} onClick={enregistrerTuiles}><Icone nom="check" /> Enregistrer</button>
            {edition.actif ? (
              <button className="pc-btn danger" style={{ flex: 1 }} onClick={() => { setARetirer(edition); setEdition(null); }}><Icone nom="user-xmark" /> Retirer l'accès</button>
            ) : (
              <button className="pc-btn second" style={{ flex: 1 }} onClick={async () => {
                try { await ProjetChaletAPI.majMembre(edition.id, { actif: true }); toast('Accès rétabli'); setEdition(null); await charger(); } catch (e: any) { setErreur(e?.message || 'Impossible.'); }
              }}>Rétablir l'accès</button>
            )}
          </div>
        </Feuille>
      )}

      {aRetirer && (
        <Confirmer
          message={`Retirer l'accès de ${aRetirer.nom} ? Il ne verra plus rien. Ce qu'il a déposé est gardé, et tu peux rétablir l'accès plus tard.`}
          libelle="Retirer l'accès"
          onNon={() => setARetirer(null)}
          onOui={async () => {
            try { await ProjetChaletAPI.majMembre(aRetirer.id, { actif: false }); toast(`Accès de ${aRetirer.nom} retiré`); } catch (e: any) { setErreur(e?.message || 'Impossible.'); }
            setARetirer(null);
            await charger();
          }}
        />
      )}
    </>
  );
}
