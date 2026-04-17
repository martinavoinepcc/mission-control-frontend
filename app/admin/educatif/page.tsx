'use client';

// /admin/educatif — Gestion du volet éducatif pour Martin.
// Fonctions :
//  - Lister les modules + accès par user
//  - Toggle accès par enfant (hasAccess)
//  - Voir progression par enfant
//  - Importer un content pack JSON (via fichier ou collage)
//  - Archiver un module

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  adminGetEduModules,
  adminGetEduModule,
  adminSetModuleAccess,
  adminImportPack,
  adminGetEduProgress,
  clearToken,
  getStoredUser,
} from '@/lib/api';
import { UI } from '@/lib/icons';

type ModuleRow = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  coverColor: string | null;
  version: string;
  status: string;
  lessonCount: number;
  accessCount: number;
};

type AccessDetail = {
  id: number;
  userId: number;
  userFirstName: string;
  userEmail: string;
  hasAccess: boolean;
};

export default function AdminEducatifPage() {
  const router = useRouter();
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, AccessDetail[]>>({});
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [tab, setTab] = useState<'modules' | 'progress' | 'import'>('modules');

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
      const [m, p] = await Promise.all([adminGetEduModules(), adminGetEduProgress()]);
      setModules(m.modules);
      setProgress(p.children);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      if (err.message.includes('Session') || err.message.includes('Authentification')) {
        clearToken();
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(id: number) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!details[id]) {
      try {
        const d = await adminGetEduModule(id);
        setDetails((prev) => ({ ...prev, [id]: d.accesses }));
      } catch (err: any) {
        setError(err.message);
      }
    }
  }

  async function handleToggleAccess(moduleId: number, userId: number, newAccess: boolean) {
    try {
      await adminSetModuleAccess(moduleId, userId, newAccess);
      setDetails((prev) => ({
        ...prev,
        [moduleId]: (prev[moduleId] || []).map((a) =>
          a.userId === userId ? { ...a, hasAccess: newAccess } : a,
        ),
      }));
      flash(newAccess ? 'Accès accordé.' : 'Accès retiré.');
    } catch (err: any) {
      setError(err.message);
    }
  }

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <FontAwesomeIcon icon={UI.spinner} className="text-neon-cyan text-3xl animate-spin" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 cosmic-grid" />
      <div className="blob bg-emerald-500 w-[420px] h-[420px] -top-32 -left-24 animate-pulse-slow opacity-20" />
      <div className="blob bg-neon-cyan w-[340px] h-[340px] -bottom-24 -right-24 animate-pulse-slow opacity-15" style={{ animationDelay: '1.5s' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <header className="flex items-center justify-between mb-8 animate-fade-up">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 text-white/70 hover:text-white text-sm"
            >
              <FontAwesomeIcon icon={UI.back} /> Admin
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <FontAwesomeIcon icon={UI.graduationCap} className="text-emerald-400" />
            </div>
            <span className="font-display font-semibold">Éducatif</span>
          </div>
        </header>

        {notice && (
          <div className="mb-5 text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
            <FontAwesomeIcon icon={UI.check} className="mr-2" /> {notice}
          </div>
        )}
        {error && (
          <div className="mb-5 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <FontAwesomeIcon icon={UI.warning} className="mr-2" /> {error}
          </div>
        )}

        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
          Administration <span className="grad-text">Éducatif</span>
        </h1>
        <p className="text-white/50 mb-8">Gère les modules, les accès par enfant et importe du contenu.</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          <TabBtn active={tab === 'modules'} onClick={() => setTab('modules')} icon={UI.cube} label={`Modules (${modules.length})`} />
          <TabBtn active={tab === 'progress'} onClick={() => setTab('progress')} icon={UI.trophy} label="Progression" />
          <TabBtn active={tab === 'import'} onClick={() => setTab('import')} icon={UI.upload} label="Importer un pack" />
        </div>

        {tab === 'modules' && (
          <div className="space-y-4">
            {modules.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-white/50">
                Aucun module installé. Importe un pack pour commencer.
              </div>
            ) : (
              modules.map((m, idx) => (
                <ModuleRowComp
                  key={m.id}
                  mod={m}
                  expanded={expanded === m.id}
                  accesses={details[m.id]}
                  onToggle={() => toggleExpand(m.id)}
                  onToggleAccess={(userId, access) => handleToggleAccess(m.id, userId, access)}
                  delay={idx * 80}
                />
              ))
            )}
          </div>
        )}

        {tab === 'progress' && <ProgressView children={progress} />}

        {tab === 'import' && <ImportPackView onImported={() => { refresh(); flash('Pack importé.'); }} onError={(m) => setError(m)} />}
      </div>
    </main>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm transition flex items-center gap-2 border-b-2 -mb-px ${
        active ? 'text-emerald-300 border-emerald-400' : 'text-white/50 border-transparent hover:text-white/80'
      }`}
    >
      <FontAwesomeIcon icon={icon} />
      {label}
    </button>
  );
}

function ModuleRowComp({
  mod,
  expanded,
  accesses,
  onToggle,
  onToggleAccess,
  delay,
}: {
  mod: ModuleRow;
  expanded: boolean;
  accesses: AccessDetail[] | undefined;
  onToggle: () => void;
  onToggleAccess: (userId: number, access: boolean) => void;
  delay: number;
}) {
  const color = mod.coverColor || '#4ADE80';
  return (
    <div className="glass rounded-2xl p-5 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}25`, border: `1px solid ${color}55` }}
          >
            <FontAwesomeIcon icon={UI.cube} style={{ color }} className="text-lg" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-display font-semibold truncate">{mod.title}</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/50">
                v{mod.version}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  mod.status === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/5 text-white/50'
                }`}
              >
                {mod.status}
              </span>
            </div>
            {mod.subtitle && <p className="text-xs text-white/50 truncate">{mod.subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-white/60">
              <FontAwesomeIcon icon={UI.flag} className="mr-1 text-amber-400" />
              {mod.lessonCount} missions
            </p>
            <p className="text-xs text-white/60">
              <FontAwesomeIcon icon={UI.user} className="mr-1 text-cyan-400" />
              {mod.accessCount} accès
            </p>
          </div>
          <FontAwesomeIcon
            icon={UI.chevronRight}
            className={`text-white/40 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="mt-5 pt-5 border-t border-white/5">
          <p className="text-xs uppercase tracking-wider text-white/40 mb-3 font-semibold">
            Accès par utilisateur
          </p>
          {!accesses ? (
            <div className="text-white/50 text-sm">
              <FontAwesomeIcon icon={UI.spinner} className="mr-2 animate-spin" />
              Chargement...
            </div>
          ) : accesses.length === 0 ? (
            <div className="text-white/50 text-sm italic">Aucun accès assigné.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {accesses.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-neon-violet/20 border border-neon-violet/40 flex items-center justify-center text-xs font-semibold text-neon-violet">
                      {a.userFirstName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{a.userFirstName}</p>
                      <p className="text-[10px] text-white/40 truncate">{a.userEmail}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleAccess(a.userId, !a.hasAccess)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      a.hasAccess
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-white/5 text-white/50 border border-white/15 hover:bg-white/10'
                    }`}
                  >
                    <FontAwesomeIcon icon={a.hasAccess ? UI.check : UI.lock} />
                    {a.hasAccess ? 'Accès' : 'Bloqué'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressView({ children }: { children: any[] }) {
  if (!children.length) {
    return (
      <div className="glass rounded-2xl p-10 text-center text-white/50">
        Aucune activité enregistrée pour le moment.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {children.map((c, idx) => (
        <div key={c.userId} className="glass rounded-2xl p-5 animate-fade-up" style={{ animationDelay: `${idx * 80}ms` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-semibold">
                {c.firstName[0]}
              </div>
              <div>
                <h3 className="font-display font-semibold">{c.firstName}</h3>
                <p className="text-[10px] text-white/40">{c.email}</p>
              </div>
            </div>
            <div className="flex gap-3 text-right">
              <MiniStat icon={UI.bolt} value={c.totalXp} label="XP" color="#06B6D4" />
              <MiniStat icon={UI.star} value={c.totalStars} label="étoiles" color="#FBBF24" />
            </div>
          </div>
          {c.modules.length === 0 ? (
            <p className="text-xs text-white/40 italic">Pas encore commencé.</p>
          ) : (
            <div className="space-y-2">
              {c.modules.map((m: any) => (
                <div key={m.moduleId} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                  <span className="font-semibold">{m.moduleTitle}</span>
                  <span className="text-white/60 text-xs">
                    {m.completed}/{m.started} missions · {m.stars} <FontAwesomeIcon icon={UI.star} className="text-amber-400" /> · {m.xp} XP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MiniStat({ icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <div className="text-center min-w-[60px]">
      <FontAwesomeIcon icon={icon} style={{ color }} className="text-sm" />
      <div className="font-display text-base font-bold">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}

function ImportPackView({ onImported, onError }: { onImported: () => void; onError: (m: string) => void }) {
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJson(text);
    parsePreview(text);
  }

  function parsePreview(text: string) {
    try {
      const obj = JSON.parse(text);
      if (!obj.module || !obj.lessons) {
        onError('Format invalide : { module, lessons } requis.');
        setPreview(null);
        return;
      }
      setPreview(obj);
    } catch {
      setPreview(null);
    }
  }

  async function doImport() {
    if (!preview) {
      onError('Aucun pack valide à importer.');
      return;
    }
    setBusy(true);
    try {
      await adminImportPack(preview);
      onImported();
      setJson('');
      setPreview(null);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 border border-amber-400/20">
        <div className="flex items-center gap-3 mb-4">
          <FontAwesomeIcon icon={UI.info} className="text-amber-300" />
          <h2 className="font-display font-semibold">Format attendu</h2>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">
          Un content pack est un JSON contenant <code className="px-1.5 py-0.5 bg-white/10 rounded text-emerald-300 text-xs">module</code> (métadonnées) et <code className="px-1.5 py-0.5 bg-white/10 rounded text-emerald-300 text-xs">lessons</code> (array). L'import est idempotent : un pack avec le même slug met à jour le module existant.
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold">Nouveau pack</h2>
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-violet/20 border border-neon-violet/40 text-neon-violet text-sm cursor-pointer hover:bg-neon-violet/30 transition">
            <FontAwesomeIcon icon={UI.upload} />
            Choisir fichier .json
            <input type="file" accept="application/json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
        <textarea
          value={json}
          onChange={(e) => { setJson(e.target.value); parsePreview(e.target.value); }}
          placeholder='Colle ici le JSON du pack :&#10;{&#10;  "module": { "slug": "...", "title": "..." },&#10;  "lessons": [...]&#10;}'
          className="w-full h-64 bg-black/40 border border-white/10 rounded-xl p-3 font-mono text-xs text-white/90 focus:outline-none focus:border-emerald-400/60"
        />
        {preview && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <FontAwesomeIcon icon={UI.check} className="text-emerald-300" />
              <span className="font-semibold text-emerald-200">JSON valide</span>
            </div>
            <p className="text-sm text-white/80">
              Module : <strong>{preview.module.title}</strong> (slug: <code className="text-emerald-300">{preview.module.slug}</code>, v{preview.module.version || '1.0.0'})
            </p>
            <p className="text-sm text-white/80">
              Missions : <strong>{preview.lessons.length}</strong>
            </p>
          </div>
        )}
        <button
          onClick={doImport}
          disabled={!preview || busy}
          className="mt-4 w-full px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white font-semibold text-sm transition shadow-lg shadow-emerald-500/40"
        >
          {busy ? (
            <>
              <FontAwesomeIcon icon={UI.spinner} className="mr-2 animate-spin" /> Import en cours...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={UI.upload} className="mr-2" /> Importer le pack
            </>
          )}
        </button>
      </div>
    </div>
  );
}
