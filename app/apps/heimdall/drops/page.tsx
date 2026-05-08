'use client';

// /apps/heimdall/drops/ — admin page pour gerer les drops (modules pousses par
// FRIDAY ou crees manuellement). Liste + creation manuelle + toggle access par user
// + delete. Phase 1 : pas encore d'auth FRIDAY HMAC, juste manuel/admin.

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faPlus,
  faTrash,
  faCheck,
  faEye,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { getStoredUser } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

type DropAccessRow = {
  userId: number;
  firstName: string;
  profile: string;
  grantedAt: string;
};

type Drop = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  iconEmoji: string | null;
  realm: string;
  status: 'PENDING' | 'APPROVED' | 'DISABLED';
  source: string | null;
  hasContent: boolean;
  contentSize: number;
  createdAt: string;
  approvedAt: string | null;
  accesses: DropAccessRow[];
};

type UserRow = { id: number; firstName: string; profile: string };

function authFetch(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const token = typeof window !== 'undefined' ? localStorage.getItem('mc_token') : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export default function DropsAdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newDrop, setNewDrop] = useState({ slug: '', title: '', description: '', iconEmoji: '📦', htmlContent: '' });
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [dropsRes, usersRes] = await Promise.all([
        authFetch('/heimdall/drops'),
        authFetch('/admin/users').catch(() => null),
      ]);
      if (!dropsRes.ok) throw new Error(`Drops: ${dropsRes.status}`);
      const dropsJson = await dropsRes.json();
      setDrops(dropsJson.drops || []);
      if (usersRes && usersRes.ok) {
        const u = await usersRes.json();
        setUsers((u.users || u || []).map((x: any) => ({ id: x.id, firstName: x.firstName, profile: x.profile || 'ADULT' })));
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) { router.push('/'); return; }
    if (u.role !== 'ADMIN') {
      setError('Section admin uniquement.');
      setLoading(false);
      return;
    }
    setMe(u);
    reload();
  }, [router, reload]);

  async function createDrop() {
    if (!newDrop.slug || !newDrop.title) {
      setError('slug + title requis');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/heimdall/drops', {
        method: 'POST',
        body: JSON.stringify({ ...newDrop, status: 'APPROVED' }),
      });
      if (!res.ok) throw new Error(`Create: ${res.status}`);
      setShowCreate(false);
      setNewDrop({ slug: '', title: '', description: '', iconEmoji: '📦', htmlContent: '' });
      await reload();
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccess(dropId: number, userId: number) {
    try {
      const res = await authFetch(`/heimdall/drops/${dropId}/access`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error(`Toggle: ${res.status}`);
      await reload();
    } catch (e: any) {
      setError(e?.message || 'Erreur toggle');
    }
  }

  async function approveDrop(id: number) {
    await authFetch(`/heimdall/drops/${id}/approve`, { method: 'POST' });
    await reload();
  }
  async function disableDrop(id: number) {
    await authFetch(`/heimdall/drops/${id}/disable`, { method: 'POST' });
    await reload();
  }
  async function deleteDrop(id: number) {
    if (!confirm('Supprimer ce drop ?')) return;
    await authFetch(`/heimdall/drops/${id}`, { method: 'DELETE' });
    await reload();
  }

  if (!me) return null;

  return (
    <main className="min-h-[100dvh] bg-cosmos-950 text-white">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-3 pb-2 border-b border-white/10 bg-cosmos-950/85 backdrop-blur-md"
        style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => router.push('/apps/heimdall/cockpit/')}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center"
          aria-label="Retour HEIMDALL"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 leading-tight">HEIMDALL</p>
          <p className="font-semibold text-base truncate leading-tight">Drops FRIDAY</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-10 px-3 rounded-xl bg-cyan-500 text-white hover:bg-cyan-400 transition flex items-center gap-2 text-sm font-semibold"
        >
          <FontAwesomeIcon icon={faPlus} />
          Nouveau
        </button>
      </header>

      <section className="max-w-4xl mx-auto p-4">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <p className="font-semibold text-white/90 mb-1">📦 Workflow</p>
          <p>FRIDAY (ou toi) dépose un module HTML ici → tu approuves → tu choisis qui peut le voir (par user) → l'user concerné l'ouvre depuis son portail. Pas d'accès donné par défaut.</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-white/50">Chargement…</div>
        ) : drops.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <p>Aucun drop pour le moment.</p>
            <p className="mt-2 text-xs">Click « Nouveau » pour en créer un manuellement, ou attends que FRIDAY pousse un module.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {drops.map((d) => (
              <li key={d.id} className="rounded-xl border border-white/10 bg-cosmos-900/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">{d.iconEmoji || '📦'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{d.title}</h3>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                        d.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                        d.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-slate-500/20 text-slate-300'
                      }`}>{d.status}</span>
                      <span className="text-[10px] text-white/40">{d.realm}</span>
                      {d.source && <span className="text-[10px] text-white/40">via {d.source}</span>}
                    </div>
                    <p className="text-xs text-white/50 mt-0.5 font-mono">{d.slug} — {d.contentSize} chars</p>
                    {d.description && <p className="text-sm text-white/70 mt-2">{d.description}</p>}

                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1.5">Accès</p>
                      <div className="flex flex-wrap gap-1.5">
                        {users.map((u) => {
                          const hasAccess = d.accesses.some((a) => a.userId === u.id);
                          return (
                            <button
                              key={u.id}
                              onClick={() => toggleAccess(d.id, u.id)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                                hasAccess
                                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-100'
                                  : 'bg-transparent border-white/15 text-white/50 hover:bg-white/5'
                              }`}
                              title={hasAccess ? `Retirer accès à ${u.firstName}` : `Donner accès à ${u.firstName}`}
                            >
                              {hasAccess && <FontAwesomeIcon icon={faCheck} className="text-[9px] mr-1" />}
                              {u.firstName}
                              <span className="ml-1 text-[9px] opacity-60">{u.profile === 'CHILD' ? 'kid' : 'adulte'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {d.hasContent && (
                      <a
                        href={`${API_URL}/heimdall/drops/${d.slug}/content`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-9 h-9 rounded-lg border border-white/15 text-white/70 hover:bg-white/5 flex items-center justify-center"
                        title="Preview HTML"
                      >
                        <FontAwesomeIcon icon={faEye} className="text-xs" />
                      </a>
                    )}
                    {d.status === 'PENDING' && (
                      <button
                        onClick={() => approveDrop(d.id)}
                        className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 flex items-center justify-center"
                        title="Approuver"
                      >
                        <FontAwesomeIcon icon={faCheck} className="text-xs" />
                      </button>
                    )}
                    {d.status === 'APPROVED' && (
                      <button
                        onClick={() => disableDrop(d.id)}
                        className="w-9 h-9 rounded-lg border border-amber-400/30 text-amber-200 hover:bg-amber-500/10 flex items-center justify-center"
                        title="Désactiver"
                      >
                        <FontAwesomeIcon icon={faXmark} className="text-xs" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteDrop(d.id)}
                      className="w-9 h-9 rounded-lg border border-rose-400/30 text-rose-200 hover:bg-rose-500/10 flex items-center justify-center"
                      title="Supprimer"
                    >
                      <FontAwesomeIcon icon={faTrash} className="text-xs" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => !saving && setShowCreate(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-cosmos-900 p-5 text-white" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Nouveau drop</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider">Slug (URL)</label>
                <input
                  type="text"
                  value={newDrop.slug}
                  onChange={(e) => setNewDrop({ ...newDrop, slug: e.target.value })}
                  placeholder="ex: spelling-quiz-v1"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-cosmos-950 text-white placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider">Titre</label>
                <input
                  type="text"
                  value={newDrop.title}
                  onChange={(e) => setNewDrop({ ...newDrop, title: e.target.value })}
                  placeholder="Quiz d'orthographe niveau 1"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-cosmos-950 text-white placeholder:text-white/30"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-white/60 uppercase tracking-wider">Description</label>
                  <input
                    type="text"
                    value={newDrop.description}
                    onChange={(e) => setNewDrop({ ...newDrop, description: e.target.value })}
                    placeholder="(optionnel)"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-cosmos-950 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="w-20">
                  <label className="text-xs text-white/60 uppercase tracking-wider">Icon</label>
                  <input
                    type="text"
                    value={newDrop.iconEmoji}
                    onChange={(e) => setNewDrop({ ...newDrop, iconEmoji: e.target.value })}
                    maxLength={4}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-cosmos-950 text-white text-center"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider">HTML standalone (optionnel)</label>
                <textarea
                  value={newDrop.htmlContent}
                  onChange={(e) => setNewDrop({ ...newDrop, htmlContent: e.target.value })}
                  placeholder="<!DOCTYPE html><html>… (laisse vide si tu veux juste reserver le drop)"
                  rows={6}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-cosmos-950 text-white placeholder:text-white/30 font-mono text-xs"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={createDrop}
                disabled={saving || !newDrop.slug || !newDrop.title}
                className="flex-1 px-4 py-2 rounded-xl bg-cyan-500 text-white hover:bg-cyan-400 transition disabled:opacity-50 font-semibold"
              >
                {saving ? 'Création…' : 'Créer + approuver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
