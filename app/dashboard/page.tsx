'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getMe, clearToken, type User, type App } from '@/lib/api';
import { UI, iconForApp } from '@/lib/icons';

type Realm = 'FAMILY' | 'WORK';

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const realmParam = (params.get('realm') || 'family').toUpperCase() as Realm;
  const realm: Realm = realmParam === 'WORK' ? 'WORK' : 'FAMILY';

  const [user, setUser] = useState<User | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMe();
        setUser(data.user);
        setApps(data.apps);
        if (data.user.mustChangePassword) router.push('/change-password');
      } catch {
        clearToken();
        router.push('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function handleLogout() { clearToken(); router.push('/'); }

  const filteredApps = useMemo(
    () => apps.filter((a) => (a.realm || 'FAMILY') === realm),
    [apps, realm]
  );

  const hasMultipleRealms = useMemo(() => {
    const set = new Set(apps.map((a) => a.realm || 'FAMILY'));
    return set.size > 1;
  }, [apps]);

  // Vibe tokens per realm. Keep class strings literal so Tailwind JIT picks them up.
  const isWork = realm === 'WORK';
  const vibe = isWork
    ? {
        label: 'Travail',
        greeting: 'Focus',
        sub: 'Espace de travail — zen, sérieux, concentré.',
        gradient: 'from-slate-400 to-emerald-300',
        blob1: 'bg-slate-500',
        blob2: 'bg-emerald-500',
        adminBtn: 'border-emerald-400/30 text-emerald-300/90 hover:bg-emerald-400/10',
        backBtn: 'border-slate-400/30 text-slate-300/90 hover:bg-slate-400/10',
      }
    : {
        label: 'Famille',
        greeting: 'Bonjour',
        sub: 'Voici tes applications disponibles.',
        gradient: 'from-neon-violet to-neon-cyan',
        blob1: 'bg-neon-violet',
        blob2: 'bg-neon-cyan',
        adminBtn: 'border-neon-violet/30 text-neon-violet/90 hover:bg-neon-violet/10',
        backBtn: 'border-white/15 text-white/70 hover:bg-white/5',
      };

  if (loading) {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 cosmic-grid" />
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="relative min-h-screen">
      <div className={`absolute inset-0 cosmic-grid ${isWork ? 'opacity-50' : ''}`} />
      {!isWork && (
        <>
          <div className="blob bg-neon-violet w-[480px] h-[480px] -top-32 -left-24 animate-pulse-slow" />
          <div className="blob bg-neon-cyan w-[400px] h-[400px] -bottom-32 -right-24 animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </>
      )}
      {isWork && (
        <div className="blob bg-emerald-600 w-[320px] h-[320px] -top-20 right-10 opacity-30 animate-pulse-slow" />
      )}

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-12 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${vibe.gradient} flex items-center justify-center`}>
              <FontAwesomeIcon icon={UI.compass} className="text-white text-lg" />
            </div>
            <span className="font-display font-semibold text-lg">Mission Control</span>
            <span className="ml-3 text-[10px] uppercase tracking-[0.25em] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
              {vibe.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {hasMultipleRealms && (
              <button
                onClick={() => router.push('/realms')}
                className={`text-sm px-4 py-2 rounded-xl border transition flex items-center gap-2 ${vibe.backBtn}`}
                title="Changer d'espace"
              >
                <FontAwesomeIcon icon={UI.compass} className="text-xs" />
                Espaces
              </button>
            )}
            {user.role === 'ADMIN' && (
              <button
                onClick={() => router.push('/admin')}
                className={`text-sm px-4 py-2 rounded-xl border transition flex items-center gap-2 ${vibe.adminBtn}`}
              >
                <FontAwesomeIcon icon={UI.admin} className="text-xs" />
                Administration
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-sm px-4 py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={UI.logout} className="text-xs" />
              Déconnexion
            </button>
          </div>
        </header>

        {/* Salutation */}
        <section className="mb-10 animate-fade-up">
          <p className="text-white/40 text-sm tracking-wider uppercase mb-2">{vibe.label}</p>
          <h1 className="text-4xl md:text-5xl font-bold font-display">
            {vibe.greeting}, <span className={`bg-gradient-to-r ${vibe.gradient} bg-clip-text text-transparent`}>{user.firstName}</span>
          </h1>
          <p className="text-white/50 mt-3">{vibe.sub}</p>
        </section>

        {/* Grille d'apps */}
        {filteredApps.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-white/60">
            Aucune application disponible dans cet espace.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredApps.map((app, idx) => (
              <AppCard key={app.id} app={app} delay={idx * 80} realm={realm} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <main className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 cosmic-grid" />
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </main>
    }>
      <DashboardInner />
    </Suspense>
  );
}

function AppCard({ app, delay, realm }: { app: App; delay: number; realm: Realm }) {
  return (
    <button
      onClick={() => {
        if (app.isMockup) {
          alert(`${app.name}\n\nBientôt disponible.`);
          return;
        }
        if (app.slug === 'educatif') window.location.href = '/apps/educatif/';
        else if (app.slug === 'maison') window.location.href = '/apps/maison/';
        else if (app.slug === 'chalet') window.location.href = '/apps/chalet/';
      }}
      className="group relative text-left rounded-2xl overflow-hidden glass p-6 transition-all hover:scale-[1.02] hover:shadow-2xl animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="absolute inset-0 opacity-20 transition-opacity group-hover:opacity-35"
        style={{ background: `radial-gradient(circle at 30% 20%, ${app.color}, transparent 70%)` }}
      />
      <div className="relative">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 transition-transform group-hover:scale-110"
          style={{ background: `${app.color}20`, border: `1px solid ${app.color}40` }}
        >
          <FontAwesomeIcon icon={iconForApp(app.icon)} className="text-2xl" style={{ color: app.color }} />
        </div>
        <h3 className="font-display text-xl font-semibold mb-1">{app.name}</h3>
        {app.description && <p className="text-white/50 text-sm mb-4">{app.description}</p>}
        {app.isMockup && (
          <span className="inline-block text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
            Bientôt disponible
          </span>
        )}
      </div>
    </button>
  );
}
