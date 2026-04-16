'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getStoredUser, clearToken } from '@/lib/api';
import { AdminAPI, type AdminUser, type AdminApp } from '@/lib/admin-api';
import { UI, iconForApp } from '@/lib/icons';

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [apps, setApps] = useState<AdminApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Garde : admin seulement
  useEffect(() => {
    const u = getStoredUser();
    if (!u || u.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    refresh();
  }, [router]);

  async function refresh() {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([AdminAPI.listUsers(), AdminAPI.listApps()]);
      setUsers(u.users);
      setApps(a.apps);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      if (err.message.includes('401') || err.message.toLowerCase().includes('session')) {
        clearToken();
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  }

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  }

  async function toggleAccess(userId: number, appId: number, current: boolean) {
    try {
      await AdminAPI.setAppAccess(userId, appId, !current);
      flash(!current ? 'Accès accordé.' : 'Accès retiré.');
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function resetPassword(user: AdminUser) {
    const newPwd = prompt(`Nouveau mot de passe pour ${user.firstName} (min 8 caractères) :`);
    if (!newPwd) return;
    if (newPwd.length < 8) return alert('Minimum 8 caractères.');
    try {
      await AdminAPI.resetPassword(user.id, newPwd);
      flash(`Mot de passe réinitialisé pour ${user.firstName}.`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deleteUser(user: AdminUser) {
    if (!confirm(`Supprimer ${user.firstName} (${user.email}) ?`)) return;
    try {
      await AdminAPI.deleteUser(user.id);
      flash(`${user.firstName} supprimé.`);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 cosmic-grid" />
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 cosmic-grid" />
      <div className="blob bg-neon-violet w-[420px] h-[420px] -top-32 -left-24 animate-pulse-slow" />
      <div className="blob bg-neon-cyan w-[340px] h-[340px] -bottom-24 -right-24 animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-10 animate-fade-up">
          <div>
            <p className="text-white/40 text-xs tracking-wider uppercase mb-1">Administration</p>
            <h1 className="text-3xl font-bold font-display">
              <span className="grad-text">Gestion de la famille</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary text-sm"
            >
              <span className="flex items-center gap-2">
                <FontAwesomeIcon icon={UI.plus} className="text-xs" />
                Nouveau membre
              </span>
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm px-4 py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={UI.back} className="text-xs" />
              Retour
            </button>
          </div>
        </header>

        {notice && (
          <div className="mb-6 text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 animate-fade-up">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-6 text-sm text-red-200 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Liste membres */}
        <div className="space-y-4">
          {users.map((u, idx) => (
            <div
              key={u.id}
              className="glass rounded-2xl p-6 animate-fade-up"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-violet to-neon-cyan flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={u.role === 'ADMIN' ? UI.admin : u.profile === 'CHILD' ? UI.child : UI.user}
                      className="text-white text-lg"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-semibold">{u.firstName}</h3>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${u.role === 'ADMIN' ? 'bg-neon-violet/20 text-neon-violet border border-neon-violet/40' : 'bg-white/5 text-white/60 border border-white/10'}`}>
                        <FontAwesomeIcon
                          icon={u.role === 'ADMIN' ? UI.admin : u.profile === 'CHILD' ? UI.child : UI.user}
                          className="text-[9px]"
                        />
                        {u.role === 'ADMIN' ? 'Admin' : u.profile === 'CHILD' ? 'Enfant' : 'Adulte'}
                      </span>
                    </div>
                    <p className="text-white/50 text-sm">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => resetPassword(u)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={UI.key} className="text-[10px]" />
                    Nouveau mdp
                  </button>
                  {u.role !== 'ADMIN' && (
                    <button
                      onClick={() => deleteUser(u)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon icon={UI.trash} className="text-[10px]" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

              {/* Toggles d'accès */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {apps.map((app) => {
                  const current = u.apps.find((a) => a.appId === app.id);
                  const hasAccess = current?.hasAccess ?? false;
                  return (
                    <button
                      key={app.id}
                      onClick={() => toggleAccess(u.id, app.id, hasAccess)}
                      className={`flex items-center gap-3 rounded-xl p-3 border transition text-left ${hasAccess ? 'border-neon-violet/40 bg-neon-violet/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}`}
                    >
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${app.color}20`, border: `1px solid ${app.color}40` }}>
                        <FontAwesomeIcon icon={iconForApp(app.icon)} style={{ color: app.color }} className="text-base" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{app.name}</div>
                        <div className={`text-[10px] uppercase tracking-wider flex items-center gap-1 ${hasAccess ? 'text-neon-violet' : 'text-white/40'}`}>
                          {hasAccess ? (
                            <>
                              <FontAwesomeIcon icon={UI.check} className="text-[9px]" />
                              Autorisé
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={UI.close} className="text-[9px]" />
                              Non autorisé
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refresh(); flash('Membre créé.'); }} />}
    </main>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [profile, setProfile] = useState<'ADULT' | 'CHILD'>('ADULT');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await AdminAPI.createUser({ email, firstName, password, role, profile });
      onCreated();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-up">
      <form onSubmit={submit} className="glass rounded-3xl p-8 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Nouveau membre</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white p-1" aria-label="Fermer">
            <FontAwesomeIcon icon={UI.close} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Prénom</label>
          <input className="input" required value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">Courriel</label>
          <input type="email" className="input" required valu