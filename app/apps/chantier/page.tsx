'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';
import {
  ChantierAPI, docFileUrl, compressImage, fmtMoney, fmtDate,
  type Overview, type JalonLite, type JalonDetail, type Contact, type Soumission,
  type Depense, type Doc, type Trade, type JalonStatus, type SoumissionStatus,
  type DocKind, type ContactStatus, type DepenseType, type ChantierPhase,
} from '@/lib/chantier-api';

const ACCENT = '#D97706';

// ===== palettes de statuts =====
const JALON_STATUS: Record<JalonStatus, { label: string; color: string; bg: string }> = {
  A_VENIR: { label: 'À venir', color: '#cbd5e1', bg: 'rgba(148,163,184,0.15)' },
  EN_COURS: { label: 'En cours', color: '#fbbf24', bg: 'rgba(217,119,6,0.18)' },
  COMPLETE: { label: 'Complété', color: '#34d399', bg: 'rgba(16,185,129,0.18)' },
  EN_RETARD: { label: 'En retard', color: '#f87171', bg: 'rgba(239,68,68,0.18)' },
  BLOQUE: { label: 'Bloqué', color: '#f87171', bg: 'rgba(239,68,68,0.14)' },
};
const SOUM_STATUS: Record<SoumissionStatus, { label: string; color: string; bg: string }> = {
  RECUE: { label: 'Reçue', color: '#cbd5e1', bg: 'rgba(148,163,184,0.15)' },
  EN_ANALYSE: { label: 'En analyse', color: '#fbbf24', bg: 'rgba(217,119,6,0.18)' },
  ACCEPTEE: { label: 'Acceptée', color: '#34d399', bg: 'rgba(16,185,129,0.18)' },
  REFUSEE: { label: 'Refusée', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
};
const CONTACT_STATUS: Record<ContactStatus, { label: string; color: string }> = {
  PRESSENTI: { label: 'Pressenti', color: '#cbd5e1' },
  SOUMISSION_RECUE: { label: 'Soumission reçue', color: '#fbbf24' },
  RETENU: { label: 'Retenu', color: '#34d399' },
  ECARTE: { label: 'Écarté', color: '#94a3b8' },
};
const TRADE_STATUT: Record<string, { label: string; color: string; bg: string }> = {
  A_VENIR: { label: 'À venir', color: '#cbd5e1', bg: 'rgba(148,163,184,0.12)' },
  SOUMISSIONS: { label: 'Soumissions', color: '#fbbf24', bg: 'rgba(217,119,6,0.15)' },
  ATTRIBUE: { label: 'Attribué', color: '#7dd3fc', bg: 'rgba(56,189,248,0.15)' },
  EN_COURS: { label: 'En cours', color: '#fbbf24', bg: 'rgba(217,119,6,0.18)' },
  TERMINE: { label: 'Terminé', color: '#34d399', bg: 'rgba(16,185,129,0.18)' },
};
const DOC_KINDS: { value: DocKind; label: string }[] = [
  { value: 'PLAN', label: 'Plan' }, { value: 'PERMIS', label: 'Permis' },
  { value: 'CONTRAT', label: 'Contrat' }, { value: 'PHOTO', label: 'Photo' },
  { value: 'RECU', label: 'Reçu' }, { value: 'AUTRE', label: 'Autre' },
];
const DEPENSE_TYPES: { value: DepenseType; label: string }[] = [
  { value: 'DEPOT', label: 'Dépôt' }, { value: 'PARTIEL', label: 'Paiement partiel' },
  { value: 'FINAL', label: 'Paiement final' }, { value: 'EXTRA', label: 'Extra' },
];

// ===== styles inline reutilisables =====
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16, padding: 16,
};
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 10, padding: '10px 12px', color: '#f1f5f9', fontSize: 16, outline: 'none',
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 4, display: 'block' };

type Tab = 'apercu' | 'jalons' | 'contacts' | 'soumissions' | 'budget' | 'photos';
const TABS: { id: Tab; label: string }[] = [
  { id: 'apercu', label: "Vue d'ensemble" },
  { id: 'jalons', label: 'Jalons' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'soumissions', label: 'Soumissions' },
  { id: 'budget', label: 'Budget' },
  { id: 'photos', label: 'Photos' },
];

export default function ChantierPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('apercu');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [jalons, setJalons] = useState<JalonLite[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [soumissions, setSoumissions] = useState<Soumission[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [photos, setPhotos] = useState<Doc[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  // modales
  const [detailJalonId, setDetailJalonId] = useState<number | null>(null);
  const [modal, setModal] = useState<null | 'jalon' | 'contact' | 'soumission' | 'depense' | 'photo' | 'budget'>(null);
  const [modalCtx, setModalCtx] = useState<{ jalonId?: number; jalon?: JalonLite | null; contact?: Contact | null }>({});

  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2600); }, []);

  const loadOverview = useCallback(async () => {
    const ov = await ChantierAPI.overview();
    setOverview(ov);
  }, []);

  const loadTrades = useCallback(async () => {
    const { trades } = await ChantierAPI.trades();
    setTrades(trades);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadOverview(), loadTrades()]);
      } catch (e: any) {
        if (String(e?.message || '').match(/401|Session|Auth/i)) { router.push('/'); return; }
        setError(e?.message || 'Erreur de chargement.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadOverview, loadTrades, router]);

  // charge la donnee de l'onglet courant
  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        if (tab === 'jalons') setJalons((await ChantierAPI.jalons()).jalons);
        else if (tab === 'contacts') setContacts((await ChantierAPI.contacts()).contacts);
        else if (tab === 'soumissions') setSoumissions((await ChantierAPI.soumissions()).soumissions);
        else if (tab === 'budget') setDepenses((await ChantierAPI.depenses()).depenses);
        else if (tab === 'photos') setPhotos((await ChantierAPI.docs({ kind: 'PHOTO' })).docs);
      } catch (e: any) {
        flash(e?.message || 'Erreur.');
      }
    })();
  }, [tab, loading, flash]);

  const refreshTab = useCallback(async () => {
    await loadOverview();
    if (tab === 'jalons') setJalons((await ChantierAPI.jalons()).jalons);
    else if (tab === 'contacts') setContacts((await ChantierAPI.contacts()).contacts);
    else if (tab === 'soumissions') setSoumissions((await ChantierAPI.soumissions()).soumissions);
    else if (tab === 'budget') setDepenses((await ChantierAPI.depenses()).depenses);
    else if (tab === 'photos') setPhotos((await ChantierAPI.docs({ kind: 'PHOTO' })).docs);
    await loadTrades();
  }, [tab, loadOverview, loadTrades]);

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </main>
    );
  }
  if (error) {
    return (
      <main style={{ minHeight: '100vh', padding: 24, color: '#f1f5f9' }}>
        <button onClick={() => router.push('/dashboard')} style={backBtnStyle}>← Retour</button>
        <div style={{ ...card, marginTop: 16, color: '#f87171' }}>{error}</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', color: '#f1f5f9', paddingBottom: 40 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 14px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => router.push('/dashboard')} style={backBtnStyle} aria-label="Retour">
            <FontAwesomeIcon icon={UI.back} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>Chantier Chalet</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {overview?.project.address || 'Lac Mékinac, Trois-Rives'}
            </div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, background: 'rgba(217,119,6,0.18)', color: '#fbbf24', padding: '5px 12px', borderRadius: 20 }}>
            {overview?.globalProgress ?? 0} %
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 14 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                whiteSpace: 'nowrap', fontSize: 14, fontWeight: 500, padding: '8px 14px', borderRadius: 20,
                border: '1px solid ' + (tab === t.id ? ACCENT : 'rgba(255,255,255,0.12)'),
                background: tab === t.id ? 'rgba(217,119,6,0.18)' : 'transparent',
                color: tab === t.id ? '#fbbf24' : 'rgba(255,255,255,0.65)', cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'apercu' && overview && (
          <ApercuView
            ov={overview}
            onOpenJalon={(id) => setDetailJalonId(id)}
            onAddSoumission={() => { setModalCtx({}); setModal('soumission'); }}
            onAddPhoto={() => { setModalCtx({}); setModal('photo'); }}
            onGoJalons={() => setTab('jalons')}
          />
        )}

        {tab === 'jalons' && (
          <JalonsView
            jalons={jalons}
            onOpen={(id) => setDetailJalonId(id)}
            onAdd={() => { setModalCtx({}); setModal('jalon'); }}
          />
        )}

        {tab === 'contacts' && (
          <ContactsView
            contacts={contacts}
            onAdd={() => { setModalCtx({ contact: null }); setModal('contact'); }}
            onEdit={(c) => { setModalCtx({ contact: c }); setModal('contact'); }}
          />
        )}

        {tab === 'soumissions' && (
          <SoumissionsView
            soumissions={soumissions}
            onAdd={() => { setModalCtx({}); setModal('soumission'); }}
            onAccept={async (s) => { await ChantierAPI.updateSoumission(s.id, { status: 'ACCEPTEE' }); flash('Soumission acceptée ✓'); await refreshTab(); }}
            onRefuse={async (s) => { await ChantierAPI.updateSoumission(s.id, { status: 'REFUSEE' }); await refreshTab(); }}
            onDelete={async (s) => { await ChantierAPI.deleteSoumission(s.id); await refreshTab(); }}
          />
        )}

        {tab === 'budget' && overview && (
          <BudgetView
            ov={overview}
            depenses={depenses}
            onAdd={() => { setModalCtx({}); setModal('depense'); }}
            onEditBudget={() => setModal('budget')}
            onDelete={async (d) => { await ChantierAPI.deleteDepense(d.id); await refreshTab(); }}
          />
        )}

        {tab === 'photos' && (
          <PhotosView
            photos={photos}
            onAdd={() => { setModalCtx({}); setModal('photo'); }}
            onDelete={async (d) => { await ChantierAPI.deleteDoc(d.id); await refreshTab(); }}
          />
        )}
      </div>

      {/* ===== Modales ===== */}
      {detailJalonId != null && (
        <JalonDetailModal
          jalonId={detailJalonId}
          trades={trades}
          contacts={contacts}
          onClose={() => setDetailJalonId(null)}
          onChanged={refreshTab}
          flash={flash}
          loadContacts={async () => { const { contacts } = await ChantierAPI.contacts(); setContacts(contacts); return contacts; }}
        />
      )}

      {modal === 'jalon' && (
        <JalonFormModal
          trades={trades}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); flash('Jalon ajouté ✓'); await refreshTab(); }}
        />
      )}
      {modal === 'contact' && (
        <ContactFormModal
          contact={modalCtx.contact ?? null}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); flash('Contact enregistré ✓'); await refreshTab(); }}
          onDelete={modalCtx.contact ? async () => { await ChantierAPI.deleteContact(modalCtx.contact!.id); setModal(null); await refreshTab(); } : undefined}
        />
      )}
      {modal === 'soumission' && (
        <SoumissionFormModal
          trades={trades}
          contacts={contacts}
          jalons={jalons}
          defaultJalonId={modalCtx.jalonId}
          onClose={() => setModal(null)}
          ensureContacts={async () => { const { contacts } = await ChantierAPI.contacts(); setContacts(contacts); return contacts; }}
          ensureJalons={async () => { const { jalons } = await ChantierAPI.jalons(); setJalons(jalons); return jalons; }}
          onSaved={async () => { setModal(null); flash('Soumission ajoutée ✓'); await refreshTab(); }}
        />
      )}
      {modal === 'depense' && (
        <DepenseFormModal
          trades={trades}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); flash('Déboursé ajouté ✓'); await refreshTab(); }}
        />
      )}
      {modal === 'photo' && (
        <PhotoFormModal
          jalons={jalons}
          defaultJalonId={modalCtx.jalonId}
          ensureJalons={async () => { const { jalons } = await ChantierAPI.jalons(); setJalons(jalons); return jalons; }}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); flash('Photo ajoutée ✓'); await refreshTab(); }}
        />
      )}
      {modal === 'budget' && overview && (
        <BudgetFormModal
          current={overview.project.budgetTotal}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); flash('Budget mis à jour ✓'); await refreshTab(); }}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.95)', border: '1px solid ' + ACCENT, color: '#f1f5f9', padding: '10px 18px', borderRadius: 12, zIndex: 60, fontSize: 14 }}>
          {toast}
        </div>
      )}
    </main>
  );
}

// ===================== SOUS-VUES =====================

function ProgressRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={9} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ACCENT} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="47%" textAnchor="middle" fontSize={22} fontWeight={700} fill="#f1f5f9">{pct}%</text>
      <text x="50%" y="63%" textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.5)">avancement</text>
    </svg>
  );
}

function ApercuView({ ov, onOpenJalon, onAddSoumission, onAddPhoto, onGoJalons }: {
  ov: Overview; onOpenJalon: (id: number) => void; onAddSoumission: () => void; onAddPhoto: () => void; onGoJalons: () => void;
}) {
  const b = ov.budget;
  const pctPaye = b.total > 0 ? Math.min(100, Math.round((b.paye / b.total) * 100)) : 0;
  const pctEngage = b.total > 0 ? Math.min(100, Math.round((b.engage / b.total) * 100)) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, display: 'flex', gap: 16, alignItems: 'center' }}>
        <ProgressRing pct={ov.globalProgress} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Prochain jalon</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{ov.nextJalons[0]?.name || '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <MiniStat label="Métiers" value={ov.counts.trades} />
            <MiniStat label="Soum." value={ov.counts.soumissions.total} />
            <MiniStat label="Photos" value={ov.counts.photos} />
          </div>
        </div>
      </div>

      {/* Budget */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Budget</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{fmtMoney(b.total)} total</span>
        </div>
        <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: `${pctPaye}%`, background: '#10b981' }} />
          <div style={{ width: `${Math.max(0, pctEngage - pctPaye)}%`, background: ACCENT }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          <Legend color="#10b981" text={`Payé ${fmtMoney(b.paye)}`} />
          <Legend color={ACCENT} text={`Engagé ${fmtMoney(b.engage)}`} />
          <Legend color="rgba(255,255,255,0.3)" text={`Restant ${fmtMoney(b.restant)}`} />
        </div>
      </div>

      {/* Prochains jalons */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Prochains jalons</span>
          <button onClick={onGoJalons} style={linkBtnStyle}>Tout voir</button>
        </div>
        {ov.nextJalons.length === 0 ? <Empty text="Aucun jalon à venir." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ov.nextJalons.map((j) => (
              <button key={j.id} onClick={() => onOpenJalon(j.id)} style={rowBtnStyle}>
                <StatusDot status={j.status} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: 14 }}>{j.name}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{fmtDate(j.dueDate)}</span>
                <FontAwesomeIcon icon={UI.chevronRight} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Corps de metier */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Corps de métier</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {ov.trades.map((t) => {
            const st = TRADE_STATUT[t.statut] || TRADE_STATUT.A_VENIR;
            return (
              <span key={t.id} style={{ fontSize: 12, background: st.bg, color: st.color, padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
                {t.name} · {st.label}{t.soumissionsCount ? ` (${t.soumissionsCount})` : ''}
              </span>
            );
          })}
        </div>
      </div>

      {/* Photos recentes */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Photos du chantier</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{ov.counts.photos}</span>
        </div>
        {ov.recentPhotos.length === 0 ? <Empty text="Aucune photo." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {ov.recentPhotos.slice(0, 4).map((p) => (
              <img key={p.id} src={docFileUrl(p)} alt={p.title} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, background: 'rgba(255,255,255,0.05)' }} />
            ))}
          </div>
        )}
        <button onClick={onAddPhoto} style={{ ...primaryBtnStyle, marginTop: 10 }}>
          <FontAwesomeIcon icon={UI.upload} /> Prendre / ajouter une photo
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onAddSoumission} style={secondaryBtnStyle}>+ Soumission</button>
        <button onClick={onGoJalons} style={secondaryBtnStyle}>Voir les jalons</button>
      </div>
    </div>
  );
}

function JalonsView({ jalons, onOpen, onAdd }: { jalons: JalonLite[]; onOpen: (id: number) => void; onAdd: () => void }) {
  const pre = jalons.filter((j) => j.phase === 'PRE_CONSTRUCTION');
  const cons = jalons.filter((j) => j.phase === 'CONSTRUCTION');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={onAdd} style={primaryBtnStyle}><FontAwesomeIcon icon={UI.plus} /> Nouveau jalon</button>
      <JalonGroup title="Pré-construction" jalons={pre} onOpen={onOpen} />
      <JalonGroup title="Construction" jalons={cons} onOpen={onOpen} />
    </div>
  );
}

function JalonGroup({ title, jalons, onOpen }: { title: string; jalons: JalonLite[]; onOpen: (id: number) => void }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{title} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>· {jalons.length}</span></div>
      {jalons.length === 0 ? <Empty text="Aucun jalon." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jalons.map((j) => {
            const st = JALON_STATUS[j.status];
            return (
              <button key={j.id} onClick={() => onOpen(j.id)} style={rowBtnStyle}>
                <StatusDot status={j.status} />
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'flex', gap: 8 }}>
                    <span style={{ color: st.color }}>{st.label}</span>
                    {j._count && j._count.soumissions > 0 && <span>{j._count.soumissions} soum.</span>}
                    {j._count && j._count.docs > 0 && <span>{j._count.docs} doc.</span>}
                    <span>{fmtDate(j.dueDate)}</span>
                  </div>
                </div>
                <FontAwesomeIcon icon={UI.chevronRight} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContactsView({ contacts, onAdd, onEdit }: { contacts: Contact[]; onAdd: () => void; onEdit: (c: Contact) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={onAdd} style={primaryBtnStyle}><FontAwesomeIcon icon={UI.plus} /> Nouveau contact</button>
      {contacts.length === 0 ? <div style={card}><Empty text="Aucun contact. Ajoute ton premier fournisseur." /></div> : contacts.map((c) => {
        const st = CONTACT_STATUS[c.status] || CONTACT_STATUS.PRESSENTI;
        return (
          <div key={c.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{c.company}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{[c.person, c.trade].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <button onClick={() => onEdit(c)} style={ghostIconBtn} aria-label="Modifier"><FontAwesomeIcon icon={UI.key} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {c.phone && <a href={`tel:${c.phone}`} style={pillLink}>📞 {c.phone}</a>}
              {c.email && <a href={`mailto:${c.email}`} style={pillLink}>✉️ {c.email}</a>}
              <span style={{ fontSize: 12, color: st.color, alignSelf: 'center' }}>● {st.label}</span>
            </div>
            {c.notes && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>{c.notes}</div>}
          </div>
        );
      })}
    </div>
  );
}

function SoumissionsView({ soumissions, onAdd, onAccept, onRefuse, onDelete }: {
  soumissions: Soumission[]; onAdd: () => void;
  onAccept: (s: Soumission) => void; onRefuse: (s: Soumission) => void; onDelete: (s: Soumission) => void;
}) {
  const minAmount = useMemo(() => {
    const vals = soumissions.filter((s) => s.amount > 0).map((s) => s.amount);
    return vals.length ? Math.min(...vals) : 0;
  }, [soumissions]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={onAdd} style={primaryBtnStyle}><FontAwesomeIcon icon={UI.plus} /> Nouvelle soumission</button>
      {soumissions.length === 0 ? <div style={card}><Empty text="Aucune soumission." /></div> : soumissions.map((s) => {
        const st = SOUM_STATUS[s.status];
        const best = s.amount > 0 && s.amount === minAmount && s.status !== 'REFUSEE';
        return (
          <div key={s.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{s.contact?.company || s.label || 'Soumission'}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  {[s.trade?.name, s.jalon?.name, s.contact?.person].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtMoney(s.amount)}</div>
                <span style={{ fontSize: 11, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 10 }}>{st.label}</span>
              </div>
            </div>
            {best && <div style={{ fontSize: 11, color: '#34d399', marginTop: 6 }}>★ Meilleur prix</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {s.status !== 'ACCEPTEE' && <button onClick={() => onAccept(s)} style={{ ...tinyBtn, borderColor: 'rgba(16,185,129,0.5)', color: '#34d399' }}>Accepter</button>}
              {s.status !== 'REFUSEE' && <button onClick={() => onRefuse(s)} style={tinyBtn}>Refuser</button>}
              <button onClick={() => onDelete(s)} style={{ ...tinyBtn, borderColor: 'rgba(239,68,68,0.4)', color: '#f87171' }}><FontAwesomeIcon icon={UI.trash} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BudgetView({ ov, depenses, onAdd, onEditBudget, onDelete }: {
  ov: Overview; depenses: Depense[]; onAdd: () => void; onEditBudget: () => void; onDelete: (d: Depense) => void;
}) {
  const b = ov.budget;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <BudgetCard label="Budget total" value={fmtMoney(b.total)} onClick={onEditBudget} editable />
        <BudgetCard label="Engagé" value={fmtMoney(b.engage)} />
        <BudgetCard label="Payé" value={fmtMoney(b.paye)} />
        <BudgetCard label="Restant" value={fmtMoney(b.restant)} danger={b.restant < 0} />
      </div>
      <button onClick={onAdd} style={primaryBtnStyle}><FontAwesomeIcon icon={UI.plus} /> Ajouter un déboursé</button>
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Déboursés</div>
        {depenses.length === 0 ? <Empty text="Aucun déboursé." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {depenses.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>{d.label || d.trade?.name || 'Déboursé'}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{[DEPENSE_TYPES.find((t) => t.value === d.type)?.label, fmtDate(d.paidAt)].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtMoney(d.amount)}</div>
                <button onClick={() => onDelete(d)} style={ghostIconBtn} aria-label="Supprimer"><FontAwesomeIcon icon={UI.trash} style={{ fontSize: 12 }} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PhotosView({ photos, onAdd, onDelete }: { photos: Doc[]; onAdd: () => void; onDelete: (d: Doc) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={onAdd} style={primaryBtnStyle}><FontAwesomeIcon icon={UI.upload} /> Prendre / ajouter une photo</button>
      {photos.length === 0 ? <div style={card}><Empty text="Aucune photo pour l'instant." /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: 'relative' }}>
              <img src={docFileUrl(p)} alt={p.title} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12, background: 'rgba(255,255,255,0.05)' }} />
              <button onClick={() => onDelete(p)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#f87171', borderRadius: 8, width: 28, height: 28, cursor: 'pointer' }} aria-label="Supprimer">
                <FontAwesomeIcon icon={UI.trash} style={{ fontSize: 12 }} />
              </button>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== JALON DETAIL =====================

function JalonDetailModal({ jalonId, trades, contacts, onClose, onChanged, flash, loadContacts }: {
  jalonId: number; trades: Trade[]; contacts: Contact[];
  onClose: () => void; onChanged: () => Promise<void>; flash: (m: string) => void;
  loadContacts: () => Promise<Contact[]>;
}) {
  const [jalon, setJalon] = useState<JalonDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState<null | 'soumission' | 'photo' | 'depense'>(null);
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);

  const reload = useCallback(async () => {
    const { jalon } = await ChantierAPI.jalon(jalonId);
    setJalon(jalon);
  }, [jalonId]);

  useEffect(() => { reload(); }, [reload]);

  async function setStatus(status: JalonStatus) {
    setBusy(true);
    try { await ChantierAPI.updateJalon(jalonId, { status }); await reload(); await onChanged(); }
    finally { setBusy(false); }
  }

  if (!jalon) {
    return <ModalShell onClose={onClose}><div style={{ padding: 20, color: '#94a3b8' }}>Chargement…</div></ModalShell>;
  }
  const st = JALON_STATUS[jalon.status];
  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{jalon.phase === 'PRE_CONSTRUCTION' ? 'Pré-construction' : 'Construction'}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{jalon.name}</div>
        </div>
        <button onClick={onClose} style={ghostIconBtn} aria-label="Fermer"><FontAwesomeIcon icon={UI.close} /></button>
      </div>

      {jalon.description && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>{jalon.description}</div>}

      {/* Statut */}
      <div style={{ marginBottom: 14 }}>
        <div style={labelStyle}>Statut</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(JALON_STATUS) as JalonStatus[]).map((s) => (
            <button key={s} disabled={busy} onClick={() => setStatus(s)}
              style={{ fontSize: 12, padding: '6px 10px', borderRadius: 16, cursor: 'pointer',
                border: '1px solid ' + (jalon.status === s ? JALON_STATUS[s].color : 'rgba(255,255,255,0.12)'),
                background: jalon.status === s ? JALON_STATUS[s].bg : 'transparent',
                color: jalon.status === s ? JALON_STATUS[s].color : 'rgba(255,255,255,0.6)' }}>
              {JALON_STATUS[s].label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Échéance : {fmtDate(jalon.dueDate)}</div>
      </div>

      {/* Plans / docs */}
      <SectionTitle title="Plans & documents" count={jalon.docs.length} onAdd={() => setSub('photo')} addLabel="+ Doc" />
      {jalon.docs.length === 0 ? <Empty text="Aucun document." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {jalon.docs.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <FontAwesomeIcon icon={UI.book} style={{ color: 'rgba(255,255,255,0.5)' }} />
              <span style={{ flex: 1, fontSize: 13 }}>{d.title}</span>
              <a href={docFileUrl(d)} target="_blank" rel="noopener noreferrer" style={ghostIconBtn}><FontAwesomeIcon icon={UI.download} style={{ fontSize: 13 }} /></a>
            </div>
          ))}
        </div>
      )}

      {/* Soumissions */}
      <SectionTitle title="Soumissions" count={jalon.soumissions.length} onAdd={async () => { await loadContacts().then(setLocalContacts); setSub('soumission'); }} addLabel="+ Soumission" />
      {jalon.soumissions.length === 0 ? <Empty text="Aucune soumission." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {jalon.soumissions.map((s) => {
            const ss = SOUM_STATUS[s.status];
            return (
              <div key={s.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s.contact?.company || s.label || 'Soumission'}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{[s.contact?.person, s.contact?.phone].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtMoney(s.amount)}</div>
                    <span style={{ fontSize: 10, background: ss.bg, color: ss.color, padding: '2px 6px', borderRadius: 8 }}>{ss.label}</span>
                  </div>
                </div>
                {s.status !== 'ACCEPTEE' && (
                  <button onClick={async () => { await ChantierAPI.updateSoumission(s.id, { status: 'ACCEPTEE' }); flash('Soumission acceptée ✓'); await reload(); await onChanged(); }}
                    style={{ ...tinyBtn, marginTop: 6, borderColor: 'rgba(16,185,129,0.5)', color: '#34d399' }}>Accepter cette soumission</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Depenses */}
      <SectionTitle title="Déboursés" count={jalon.depenses.length} onAdd={() => setSub('depense')} addLabel="+ Déboursé" />
      {jalon.depenses.length === 0 ? <Empty text="Aucun déboursé." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {jalon.depenses.map((d) => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
              <span>{d.label || DEPENSE_TYPES.find((t) => t.value === d.type)?.label}</span>
              <span style={{ fontWeight: 600 }}>{fmtMoney(d.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={onClose} style={{ ...secondaryBtnStyle, marginTop: 16 }}>Fermer</button>

      {sub === 'soumission' && (
        <SoumissionFormModal
          trades={trades} contacts={localContacts} jalons={[]} defaultJalonId={jalonId} lockJalon
          ensureContacts={async () => { const c = await loadContacts(); setLocalContacts(c); return c; }}
          ensureJalons={async () => []}
          onClose={() => setSub(null)}
          onSaved={async () => { setSub(null); await reload(); await onChanged(); }}
        />
      )}
      {sub === 'photo' && (
        <PhotoFormModal jalons={[]} defaultJalonId={jalonId} lockJalon ensureJalons={async () => []}
          onClose={() => setSub(null)} onSaved={async () => { setSub(null); await reload(); await onChanged(); }} />
      )}
      {sub === 'depense' && (
        <DepenseFormModal trades={trades} defaultJalonId={jalonId}
          onClose={() => setSub(null)} onSaved={async () => { setSub(null); await reload(); await onChanged(); }} />
      )}
    </ModalShell>
  );
}

// ===================== FORMULAIRES =====================

function JalonFormModal({ trades, onClose, onSaved }: { trades: Trade[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<ChantierPhase>('CONSTRUCTION');
  const [dueDate, setDueDate] = useState('');
  const [tradeId, setTradeId] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await ChantierAPI.createJalon({
        name, phase, description: description || undefined,
        dueDate: dueDate || undefined, tradeId: tradeId ? Number(tradeId) : undefined,
      } as any);
      onSaved();
    } catch (e: any) { alert(e?.message || 'Erreur'); setBusy(false); }
  }
  return (
    <ModalShell onClose={onClose}>
      <FormTitle title="Nouveau jalon" onClose={onClose} />
      <Field label="Nom du jalon"><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Coulée de la fondation" /></Field>
      <Field label="Phase">
        <select style={inputStyle} value={phase} onChange={(e) => setPhase(e.target.value as ChantierPhase)}>
          <option value="PRE_CONSTRUCTION">Pré-construction</option>
          <option value="CONSTRUCTION">Construction</option>
        </select>
      </Field>
      <Field label="Corps de métier (optionnel)">
        <select style={inputStyle} value={tradeId} onChange={(e) => setTradeId(e.target.value)}>
          <option value="">— Aucun —</option>
          {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Échéance (optionnel)"><input type="date" style={inputStyle} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      <Field label="Description (optionnel)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <button disabled={busy} onClick={save} style={primaryBtnStyle}>{busy ? 'Enregistrement…' : 'Ajouter le jalon'}</button>
    </ModalShell>
  );
}

function ContactFormModal({ contact, onClose, onSaved, onDelete }: { contact: Contact | null; onClose: () => void; onSaved: () => void; onDelete?: () => void }) {
  const [company, setCompany] = useState(contact?.company || '');
  const [person, setPerson] = useState(contact?.person || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [email, setEmail] = useState(contact?.email || '');
  const [trade, setTrade] = useState(contact?.trade || '');
  const [status, setStatus] = useState<ContactStatus>(contact?.status || 'PRESSENTI');
  const [notes, setNotes] = useState(contact?.notes || '');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!company.trim()) return;
    setBusy(true);
    try {
      const body = { company, person, phone, email, trade, status, notes } as any;
      if (contact) await ChantierAPI.updateContact(contact.id, body);
      else await ChantierAPI.createContact(body);
      onSaved();
    } catch (e: any) { alert(e?.message || 'Erreur'); setBusy(false); }
  }
  return (
    <ModalShell onClose={onClose}>
      <FormTitle title={contact ? 'Modifier le contact' : 'Nouveau contact'} onClose={onClose} />
      <Field label="Entreprise"><input style={inputStyle} value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
      <Field label="Personne contact"><input style={inputStyle} value={person} onChange={(e) => setPerson(e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Téléphone" flex><input style={inputStyle} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Métier" flex><input style={inputStyle} value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="ex. Plombier" /></Field>
      </div>
      <Field label="Courriel"><input style={inputStyle} inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Statut">
        <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as ContactStatus)}>
          {(Object.keys(CONTACT_STATUS) as ContactStatus[]).map((s) => <option key={s} value={s}>{CONTACT_STATUS[s].label}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 50 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button disabled={busy} onClick={save} style={primaryBtnStyle}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      {onDelete && <button onClick={onDelete} style={{ ...secondaryBtnStyle, marginTop: 8, color: '#f87171', borderColor: 'rgba(239,68,68,0.4)' }}>Supprimer</button>}
    </ModalShell>
  );
}

function SoumissionFormModal({ trades, contacts, jalons, defaultJalonId, lockJalon, ensureContacts, ensureJalons, onClose, onSaved }: {
  trades: Trade[]; contacts: Contact[]; jalons: JalonLite[]; defaultJalonId?: number; lockJalon?: boolean;
  ensureContacts: () => Promise<Contact[]>; ensureJalons: () => Promise<JalonLite[]>;
  onClose: () => void; onSaved: () => void;
}) {
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  const [localJalons, setLocalJalons] = useState<JalonLite[]>(jalons);
  const [contactId, setContactId] = useState('');
  const [newContact, setNewContact] = useState('');
  const [amount, setAmount] = useState('');
  const [jalonId, setJalonId] = useState(defaultJalonId ? String(defaultJalonId) : '');
  const [tradeId, setTradeId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!contacts.length) ensureContacts().then(setLocalContacts).catch(() => {}); }, [contacts.length, ensureContacts]);
  useEffect(() => { if (!lockJalon && !jalons.length) ensureJalons().then(setLocalJalons).catch(() => {}); }, [lockJalon, jalons.length, ensureJalons]);

  async function save() {
    setBusy(true);
    try {
      let cid = contactId ? Number(contactId) : undefined;
      if (!cid && newContact.trim()) {
        const { contact } = await ChantierAPI.createContact({ company: newContact.trim(), status: 'SOUMISSION_RECUE' } as any);
        cid = contact.id;
      }
      await ChantierAPI.createSoumission({
        amount: Number(amount) || 0, contactId: cid, notes: notes || undefined,
        jalonId: jalonId ? Number(jalonId) : undefined, tradeId: tradeId ? Number(tradeId) : undefined,
      } as any);
      onSaved();
    } catch (e: any) { alert(e?.message || 'Erreur'); setBusy(false); }
  }
  return (
    <ModalShell onClose={onClose}>
      <FormTitle title="Nouvelle soumission" onClose={onClose} />
      <Field label="Contact existant">
        <select style={inputStyle} value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">— Nouveau / aucun —</option>
          {localContacts.map((c) => <option key={c.id} value={c.id}>{c.company}{c.person ? ` (${c.person})` : ''}</option>)}
        </select>
      </Field>
      {!contactId && <Field label="…ou nouveau contact (entreprise)"><input style={inputStyle} value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="ex. Excavation Mékinac" /></Field>}
      <Field label="Montant ($)"><input style={inputStyle} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ex. 12500" /></Field>
      {!lockJalon && (
        <Field label="Rattacher à un jalon (optionnel)">
          <select style={inputStyle} value={jalonId} onChange={(e) => setJalonId(e.target.value)}>
            <option value="">— Aucun —</option>
            {localJalons.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Corps de métier (optionnel)">
        <select style={inputStyle} value={tradeId} onChange={(e) => setTradeId(e.target.value)}>
          <option value="">— Aucun —</option>
          {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 50 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button disabled={busy} onClick={save} style={primaryBtnStyle}>{busy ? 'Enregistrement…' : 'Ajouter la soumission'}</button>
    </ModalShell>
  );
}

function DepenseFormModal({ trades, defaultJalonId, onClose, onSaved }: { trades: Trade[]; defaultJalonId?: number; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<DepenseType>('PARTIEL');
  const [tradeId, setTradeId] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await ChantierAPI.createDepense({
        label: label || undefined, amount: Number(amount) || 0, type,
        tradeId: tradeId ? Number(tradeId) : undefined, jalonId: defaultJalonId,
        paidAt: paidAt || undefined,
      } as any);
      onSaved();
    } catch (e: any) { alert(e?.message || 'Erreur'); setBusy(false); }
  }
  return (
    <ModalShell onClose={onClose}>
      <FormTitle title="Ajouter un déboursé" onClose={onClose} />
      <Field label="Description"><input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Dépôt excavation" /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Montant ($)" flex><input style={inputStyle} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Type" flex>
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value as DepenseType)}>
            {DEPENSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Corps de métier (optionnel)">
        <select style={inputStyle} value={tradeId} onChange={(e) => setTradeId(e.target.value)}>
          <option value="">— Aucun —</option>
          {trades.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Date (optionnel)"><input type="date" style={inputStyle} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></Field>
      <button disabled={busy} onClick={save} style={primaryBtnStyle}>{busy ? 'Enregistrement…' : 'Ajouter'}</button>
    </ModalShell>
  );
}

function PhotoFormModal({ jalons, defaultJalonId, lockJalon, ensureJalons, onClose, onSaved }: {
  jalons: JalonLite[]; defaultJalonId?: number; lockJalon?: boolean;
  ensureJalons: () => Promise<JalonLite[]>; onClose: () => void; onSaved: () => void;
}) {
  const [localJalons, setLocalJalons] = useState<JalonLite[]>(jalons);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<DocKind>('PHOTO');
  const [jalonId, setJalonId] = useState(defaultJalonId ? String(defaultJalonId) : '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!lockJalon && !jalons.length) ensureJalons().then(setLocalJalons).catch(() => {}); }, [lockJalon, jalons.length, ensureJalons]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    try {
      if (f.type.startsWith('image/')) {
        const { dataUrl } = await compressImage(f);
        setPreview(dataUrl);
      } else {
        setPreview(null);
      }
    } catch { setPreview(null); }
  }

  async function save() {
    if (!file) { alert('Choisis un fichier ou prends une photo.'); return; }
    if (!title.trim()) { alert('Donne un titre.'); return; }
    setBusy(true);
    try {
      let dataUrl: string;
      let mimeType = file.type;
      let width: number | undefined;
      let height: number | undefined;
      if (file.type.startsWith('image/')) {
        const c = await compressImage(file);
        dataUrl = c.dataUrl; width = c.width; height = c.height; mimeType = 'image/webp';
      } else {
        dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
      }
      await ChantierAPI.createDoc({
        kind, title: title.trim(), fileData: dataUrl, mimeType, width, height,
        jalonId: jalonId ? Number(jalonId) : undefined,
      });
      onSaved();
    } catch (e: any) { alert(e?.message || 'Erreur'); setBusy(false); }
  }
  return (
    <ModalShell onClose={onClose}>
      <FormTitle title="Ajouter un document / photo" onClose={onClose} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <label style={{ ...secondaryBtnStyle, cursor: 'pointer' }}>
          📷 Caméra
          <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
        </label>
        <label style={{ ...secondaryBtnStyle, cursor: 'pointer' }}>
          <FontAwesomeIcon icon={UI.upload} /> Fichier
          <input type="file" accept="image/*,application/pdf" onChange={onFile} style={{ display: 'none' }} />
        </label>
      </div>
      {preview && <img src={preview} alt="aperçu" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 12, marginBottom: 10 }} />}
      {file && !preview && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>Fichier : {file.name}</div>}
      <Field label="Titre"><input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Type">
        <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
          {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </Field>
      {!lockJalon && (
        <Field label="Rattacher à un jalon (optionnel)">
          <select style={inputStyle} value={jalonId} onChange={(e) => setJalonId(e.target.value)}>
            <option value="">— Aucun —</option>
            {localJalons.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </Field>
      )}
      <button disabled={busy} onClick={save} style={primaryBtnStyle}>{busy ? 'Téléversement…' : 'Ajouter'}</button>
    </ModalShell>
  );
}

function BudgetFormModal({ current, onClose, onSaved }: { current: number; onClose: () => void; onSaved: () => void }) {
  const [budget, setBudget] = useState(String(current || ''));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await ChantierAPI.updateProject({ budgetTotal: Number(budget) || 0 }); onSaved(); }
    catch (e: any) { alert(e?.message || 'Erreur'); setBusy(false); }
  }
  return (
    <ModalShell onClose={onClose}>
      <FormTitle title="Budget total du chantier" onClose={onClose} />
      <Field label="Budget total ($)"><input style={inputStyle} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="ex. 420000" /></Field>
      <button disabled={busy} onClick={save} style={primaryBtnStyle}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
    </ModalShell>
  );
}

// ===================== PETITS COMPOSANTS =====================

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '18px 18px 0 0', padding: 18, paddingBottom: 'max(18px, env(safe-area-inset-bottom))' }}>
        {children}
      </div>
    </div>
  );
}

function FormTitle({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
      <button onClick={onClose} style={ghostIconBtn} aria-label="Fermer"><FontAwesomeIcon icon={UI.close} /></button>
    </div>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <div style={{ marginBottom: 12, flex: flex ? 1 : undefined, minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ title, count, onAdd, addLabel }: { title: string; count: number; onAdd: () => void; addLabel: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{title} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>· {count}</span></span>
      <button onClick={onAdd} style={linkBtnStyle}>{addLabel}</button>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function BudgetCard({ label, value, onClick, editable, danger }: { label: string; value: string; onClick?: () => void; editable?: boolean; danger?: boolean }) {
  return (
    <div onClick={onClick} style={{ ...card, cursor: onClick ? 'pointer' : 'default', padding: 14 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
        {label}{editable && <FontAwesomeIcon icon={UI.key} style={{ fontSize: 10 }} />}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: danger ? '#f87171' : '#f1f5f9' }}>{value}</div>
    </div>
  );
}

function StatusDot({ status }: { status: JalonStatus }) {
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: JALON_STATUS[status].color, flexShrink: 0 }} />;
}

function Legend({ color, text }: { color: string; text: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{text}</span>;
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: '8px 0' }}>{text}</div>;
}

// ===================== styles boutons =====================
const backBtnStyle: React.CSSProperties = { width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: '#f1f5f9', cursor: 'pointer', flexShrink: 0 };
const primaryBtnStyle: React.CSSProperties = { width: '100%', minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: ACCENT, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' };
const secondaryBtnStyle: React.CSSProperties = { flex: 1, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer' };
const rowBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', color: '#f1f5f9', width: '100%' };
const tinyBtn: React.CSSProperties = { fontSize: 12, padding: '6px 12px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: '#f1f5f9', cursor: 'pointer' };
const linkBtnStyle: React.CSSProperties = { fontSize: 13, color: '#fbbf24', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 500 };
const ghostIconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#cbd5e1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const pillLink: React.CSSProperties = { fontSize: 12, color: '#7dd3fc', textDecoration: 'none', background: 'rgba(56,189,248,0.1)', padding: '5px 10px', borderRadius: 16 };
