'use client';

// =====================================================================
// REQUIS DE LA BANQUE — par stade / déboursé.
// Utilisé par : l'écran Jalons (carte « Requis de la banque ») et l'écran
// Budget (tap sur un déboursé). Tuile requise : « jalons » ou « budget ».
// ---------------------------------------------------------------------
// Un stade = un déboursé (stade N ↔ déboursé d'ordre N). Contenu :
//   - les POSTES de la grille d'inspection de la banque (modèle AvancementItem) ;
//     case cochée = 100 %, décochée = 0 % (le détail 25/50/75 reste dans Jalons) ;
//   - l'inspection et les documents à remettre (modèle RequisBanque).
// Chaque requis a une source : « Grille » (lu dans la grille de la banque),
// « À confirmer » (usage courant, jamais lu dans une pièce de la banque) ou
// « Confirmé » (Martin a confirmé avec la banque).
// Bouton « Copier / Envoyer » = liste texte prête pour la banque ou CDH.
//
// Routes (via lib/chantier-api.ts) :
//   GET   /chantier/requis            stades + postes + requis
//   PATCH /chantier/requis/:id        cocher (fait) / changer la source (proprio)
//   POST  /chantier/requis            ajouter un requis (proprio)
//   DELETE /chantier/requis/:id       retirer un requis (proprio)
//   PATCH /chantier/avancement/:id    cocher un poste de la grille (proprio)
// =====================================================================

import { useCallback, useEffect, useState } from 'react';
import { ChantierAPI, type StadeRequis, type RequisBanque } from '@/lib/chantier-api';
import { useChalet, Icone, Chip, Feuille, Erreur, Champ, argent } from '../_kit/ui';

const NOM_STADE: Record<number, string> = {
  1: 'Fondation et charpente',
  2: 'Systèmes et recouvrements',
  3: 'Finition',
};
const nomStade = (n: number) => NOM_STADE[n] || `Stade ${n}`;
const r1 = (n: number) => Math.round(n * 10) / 10;
const virg = (n: number) => String(r1(n)).replace('.', ',');

function sourceLib(s: RequisBanque['source']): { texte: string; v: 'ok' | 'warn' | 'info' } {
  if (s === 'GRILLE') return { texte: 'Lu dans la grille', v: 'ok' };
  if (s === 'MARTIN') return { texte: 'Confirmé', v: 'info' };
  return { texte: 'À confirmer', v: 'warn' };
}

/** Texte prêt à envoyer à la banque ou à CDH pour un stade. */
export function texteRequis(st: StadeRequis, adresse = '396, chemin du Lac-Mékinac, Trois-Rives'): string {
  const d = st.debourse;
  const poids = st.postes.reduce((a, p) => a + p.weight, 0);
  const L: string[] = [];
  L.push(`REQUIS DE LA BANQUE — ${d ? d.label : `Stade ${st.stade} : ${nomStade(st.stade)}`}`);
  L.push(`Chalet, ${adresse}`);
  if (d && d.amount !== undefined) L.push(`Montant du déboursé : ${argent(d.amount)}`);
  L.push('');
  L.push(`POSTES DE LA GRILLE D'INSPECTION À COMPLÉTER (${virg(poids)} % du projet)`);
  for (const p of st.postes) {
    L.push(`${p.pct >= 100 ? '[x]' : '[ ]'} ${p.name} — pèse ${virg(p.weight)} % — terminé ${p.pct} %`);
  }
  const insp = st.requis.filter((r) => r.kind === 'INSPECTION');
  const docs = st.requis.filter((r) => r.kind === 'DOC');
  const ligne = (r: RequisBanque) => {
    const bits = [r.responsable ? `(${r.responsable})` : '', r.source === 'A_CONFIRMER' ? '(à confirmer avec la banque)' : ''].filter(Boolean).join(' ');
    return `${r.fait ? '[x]' : '[ ]'} ${r.titre}${bits ? ' ' + bits : ''}`;
  };
  if (insp.length) { L.push(''); L.push('INSPECTION'); insp.forEach((r) => L.push(ligne(r))); }
  if (docs.length) { L.push(''); L.push('DOCUMENTS ET PREUVES À REMETTRE'); docs.forEach((r) => L.push(ligne(r))); }
  return L.join('\n');
}

async function copierTexte(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
}

async function envoyerTexte(t: string, titre: string): Promise<'partage' | 'copie' | 'echec'> {
  const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
  if (nav.share) {
    try { await nav.share({ title: titre, text: t }); return 'partage'; } catch { /* annulé : on tente la copie */ }
  }
  return (await copierTexte(t)) ? 'copie' : 'echec';
}

function useRequis() {
  const [stades, setStades] = useState<StadeRequis[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(async () => {
    try { setStades((await ChantierAPI.requisBanque()).stades); setErreur(null); }
    catch { setErreur('Les requis de la banque ne se chargent pas.'); }
  }, []);
  useEffect(() => { charger(); }, [charger]);
  return { stades, erreur, charger };
}

// ---------------------------------------------------------------------
// Carte « Requis de la banque » : une ligne par déboursé, un tap ouvre le détail
// ---------------------------------------------------------------------
export function CarteRequis({ stadeInitial }: { stadeInitial?: number }) {
  const { stades, erreur, charger } = useRequis();
  const [ouvert, setOuvert] = useState<number | null>(stadeInitial ?? null);
  if (erreur) return <Erreur message={erreur} />;
  if (!stades || !stades.length) return null;
  return (
    <section className="pc-carte" style={{ padding: 14 }}>
      <span className="pc-surtitre"><Icone nom="clipboard-list" /> Requis de la banque</span>
      <div className="pc-muted pc-petit" style={{ margin: '4px 0 8px' }}>Ce qu'il faut pour chaque déboursé. Touche un déboursé pour le détail.</div>
      {stades.map((st) => <LigneStade key={st.stade} st={st} onOuvrir={() => setOuvert(st.stade)} />)}
      {ouvert !== null && <FeuilleRequis stadeNum={ouvert} onFermer={() => { setOuvert(null); charger(); }} />}
    </section>
  );
}

function LigneStade({ st, onOuvrir }: { st: StadeRequis; onOuvrir: () => void }) {
  const aFaire = st.requis.filter((r) => !r.fait).length + st.postes.filter((p) => p.pct < 100).length;
  const total = st.requis.length + st.postes.length;
  const confirmer = st.requis.filter((r) => r.source === 'A_CONFIRMER').length;
  return (
    <button className="pc-ligne" style={{ border: '1px solid var(--pc-ligne)', borderRadius: 12, marginTop: 6, width: '100%' }} onClick={onOuvrir}>
      <span className="pc-txt">
        <b>{st.debourse ? st.debourse.label : `Stade ${st.stade} — ${nomStade(st.stade)}`}</b>
        <small>
          {total - aFaire}/{total} faits{confirmer ? ` · ${confirmer} à confirmer` : ''}
          {st.debourse && st.debourse.amount !== undefined ? ` · ${argent(st.debourse.amount)}` : ''}
        </small>
      </span>
      <Icone nom="chevron-right" className="pc-muted" />
    </button>
  );
}

/** Bouton compact pour un déboursé (écran Budget) : ouvre directement le détail du stade. */
export function BoutonRequis({ ordre }: { ordre: number }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button className="pc-icobtn" onClick={() => setOuvert(true)} aria-label={`Requis de la banque du déboursé ${ordre}`}>
        <Icone nom="clipboard-list" />
      </button>
      {ouvert && <FeuilleRequis stadeNum={ordre} onFermer={() => setOuvert(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------
// Détail d'un stade (feuille)
// ---------------------------------------------------------------------
export function FeuilleRequis({ stadeNum, onFermer }: { stadeNum: number; onFermer: () => void }) {
  const { proprio, toast, recharger } = useChalet();
  const { stades, erreur: errChargement, charger } = useRequis();
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  const [titre, setTitre] = useState('');
  const st = stades?.find((s) => s.stade === stadeNum) || null;

  async function agir(cle: string, f: () => Promise<unknown>, etape?: () => void) {
    setOccupe(cle); setErreur(null);
    try { await f(); etape?.(); await charger(); } catch { setErreur("L'enregistrement a échoué, réessaie."); }
    finally { setOccupe(null); }
  }
  const cocherPoste = (id: number, pct: number) =>
    agir(`p${id}`, () => ChantierAPI.updateAvancement(id, pct >= 100 ? 0 : 100), () => { recharger(); });
  const cocherRequis = (r: RequisBanque) => agir(`r${r.id}`, () => ChantierAPI.updateRequis(r.id, { fait: !r.fait }));
  const confirmerRequis = (r: RequisBanque) =>
    agir(`s${r.id}`, () => ChantierAPI.updateRequis(r.id, { source: r.source === 'A_CONFIRMER' ? 'MARTIN' : 'A_CONFIRMER' }));
  const retirer = (r: RequisBanque) => agir(`d${r.id}`, () => ChantierAPI.deleteRequis(r.id), () => toast('Requis retiré'));
  async function ajouter() {
    if (!titre.trim()) return;
    await agir('ajout', () => ChantierAPI.createRequis({ stade: stadeNum, kind: 'DOC', titre: titre.trim() }), () => { setTitre(''); setAjout(false); toast('Requis ajouté'); });
  }
  async function exporter(mode: 'copie' | 'envoi') {
    if (!st) return;
    const t = texteRequis(st);
    if (mode === 'envoi') {
      const r = await envoyerTexte(t, `Requis banque — stade ${st.stade}`);
      toast(r === 'partage' ? 'Partagé' : r === 'copie' ? 'Liste copiée' : 'Copie impossible');
    } else {
      toast((await copierTexte(t)) ? 'Liste copiée' : 'Copie impossible');
    }
  }

  const poids = st ? st.postes.reduce((a, p) => a + p.weight, 0) : 0;
  const insp = st ? st.requis.filter((r) => r.kind === 'INSPECTION') : [];
  const docs = st ? st.requis.filter((r) => r.kind === 'DOC') : [];

  return (
    <Feuille titre={st?.debourse ? st.debourse.label : `Stade ${stadeNum} — ${nomStade(stadeNum)}`} onFermer={onFermer}>
      <Erreur message={erreur || errChargement} />
      {!st && !errChargement && <div className="pc-muted">Chargement…</div>}
      {st && (
        <>
          {st.debourse && st.debourse.amount !== undefined && (
            <div className="pc-petit" style={{ marginBottom: 8 }}>
              Déboursé : <b className="pc-cote">{argent(st.debourse.amount)}</b>{st.debourse.recu ? ' · déjà reçu' : ''}
            </div>
          )}
          <div className="pc-rangee" style={{ gap: 8, marginBottom: 10 }}>
            <button className="pc-btn" style={{ flex: 1 }} onClick={() => exporter('copie')}><Icone nom="copy" /> Copier la liste</button>
            <button className="pc-btn" style={{ flex: 1 }} onClick={() => exporter('envoi')}><Icone nom="share-nodes" /> Envoyer</button>
          </div>

          {insp.length > 0 && <h4 className="pc-surtitre" style={{ margin: '10px 0 4px' }}>Inspection</h4>}
          {insp.map((r) => <LigneRequis key={r.id} r={r} proprio={proprio} occupe={occupe} onCocher={cocherRequis} onConfirmer={confirmerRequis} onRetirer={retirer} />)}

          <h4 className="pc-surtitre" style={{ margin: '12px 0 4px' }}>Postes de la grille à compléter · {virg(poids)} %</h4>
          {st.postes.map((p) => (
            <div key={p.id} className="pc-ligne" style={{ padding: '8px 0' }}>
              <button
                className={`pc-pt ${p.pct >= 100 ? 'pc-c-ok' : 'pc-c-neutre'}`}
                style={{ border: 0 }}
                disabled={!proprio || occupe === `p${p.id}`}
                aria-pressed={p.pct >= 100}
                aria-label={`${p.name} : ${p.pct >= 100 ? 'terminé' : 'à faire'}`}
                onClick={() => cocherPoste(p.id, p.pct)}
              >
                <Icone nom={p.pct >= 100 ? 'check' : 'square'} />
              </button>
              <span className="pc-txt">
                <b style={{ fontSize: 13.5 }}>{p.name}</b>
                <small>pèse {virg(p.weight)} %{p.pct > 0 && p.pct < 100 ? ` · en cours ${p.pct} %` : ''}</small>
              </span>
              <Chip v="ok">Grille</Chip>
            </div>
          ))}

          <h4 className="pc-surtitre" style={{ margin: '12px 0 4px' }}>Documents et preuves à remettre</h4>
          {docs.map((r) => <LigneRequis key={r.id} r={r} proprio={proprio} occupe={occupe} onCocher={cocherRequis} onConfirmer={confirmerRequis} onRetirer={retirer} />)}
          {docs.length === 0 && <div className="pc-muted pc-petit">Aucun document pour ce stade.</div>}

          <div className="pc-muted pc-petit" style={{ marginTop: 10 }}>
            « À confirmer » = usage courant du financement de construction, pas lu dans un document de la banque. Touche l'étiquette pour la passer à « Confirmé » quand la banque te l'a confirmé.
          </div>

          {proprio && (ajout ? (
            <div style={{ marginTop: 10 }}>
              <Champ id="req-titre" label="Nouveau requis">
                <input id="req-titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Preuve d'assurance" />
              </Champ>
              <div className="pc-rangee" style={{ gap: 8 }}>
                <button className="pc-btn" onClick={ajouter} disabled={occupe === 'ajout'}>Ajouter</button>
                <button className="pc-lien" onClick={() => { setAjout(false); setTitre(''); }}>Annuler</button>
              </div>
            </div>
          ) : (
            <button className="pc-lien" style={{ marginTop: 10 }} onClick={() => setAjout(true)}><Icone nom="plus" /> Ajouter un requis</button>
          ))}
        </>
      )}
    </Feuille>
  );
}

function LigneRequis({ r, proprio, occupe, onCocher, onConfirmer, onRetirer }: {
  r: RequisBanque; proprio: boolean; occupe: string | null;
  onCocher: (r: RequisBanque) => void; onConfirmer: (r: RequisBanque) => void; onRetirer: (r: RequisBanque) => void;
}) {
  const s = sourceLib(r.source);
  return (
    <div className="pc-ligne" style={{ padding: '8px 0', alignItems: 'flex-start' }}>
      <button
        className={`pc-pt ${r.fait ? 'pc-c-ok' : 'pc-c-neutre'}`}
        style={{ border: 0 }}
        disabled={!proprio || occupe === `r${r.id}`}
        aria-pressed={r.fait}
        aria-label={`${r.titre} : ${r.fait ? 'fait' : 'à faire'}`}
        onClick={() => onCocher(r)}
      >
        <Icone nom={r.fait ? 'check' : 'square'} />
      </button>
      <span className="pc-txt">
        <b style={{ fontSize: 13.5 }}>{r.titre}</b>
        <small>{[r.responsable, r.detail].filter(Boolean).join(' · ')}</small>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {proprio && r.source !== 'GRILLE' ? (
          <button style={{ border: 0, background: 'none', padding: 0 }} onClick={() => onConfirmer(r)} aria-label={`Basculer la source de « ${r.titre} »`}>
            <Chip v={s.v}>{s.texte}</Chip>
          </button>
        ) : <Chip v={s.v}>{s.texte}</Chip>}
        {proprio && r.source !== 'GRILLE' && (
          <button className="pc-lien pc-petit" onClick={() => onRetirer(r)} aria-label={`Retirer « ${r.titre} »`}>Retirer</button>
        )}
      </span>
    </div>
  );
}
