'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getMe, clearToken, type User, type App } from '@/lib/api';
import { UI } from '@/lib/icons';

type Realm = 'FAMILY' | 'WORK';

export default function RealmsPage() {
  const router = useRouter();
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

  const realmCounts = useMemo(() => {
    const counts = { FAMILY: 0, WORK: 0 } as Record<Realm, number>;
    apps.forEach((a) => {
      const r = (a.realm || 'FAMILY') as Realm;
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [apps]);

  useEffect(() => {
    if (loading) return;
    const accessible = (Object.keys(realmCounts) as Realm[]).filter((r) => realmCounts[r] > 0);
    if (accessible.length <= 1) {
      router.replace('/dashboard');
    }
  }, [loading, realmCounts, router]);

  function handleLogout() { clearToken(); router.push('/'); }

  if (loading || !user) {
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
      <div className="blob bg-neon-violet w-[420px] h-[420px] -top-24 -left-20 animate-pulse-slow opacity-60" />
      <div className="blob bg-sky-500 w-[420px] h-[420px] -bottom-24 -right-20 animate-pulse-slow opacity-30" style={{ animationDelay: '2s' }} />

      <div
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-6 sm:pb-12"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-2 mb-10 sm:mb-16 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-cosmos-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/mc-logo-80.png"
                alt="Mission Control"
                draggable={false}
                className="w-10 h-10 object-contain"
              />
            </div>
            <span className="font-display font-semibold text-lg">Mission Control</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm px-3 sm:px-4 py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center gap-2 flex-shrink-0"
            aria-label="Déconnexion"
          >
            <FontAwesomeIcon icon={UI.logout} className="text-xs" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </header>

        {/* Titre */}
        <section className="mb-8 sm:mb-14 animate-fade-up text-center">
          <p className="text-white/40 text-sm tracking-wider uppercase mb-2">Bonjour, {user.firstName}</p>
          <h1 className="text-4xl md:text-5xl font-bold font-display">
            Où tu vas <span className="bg-gradient-to-r from-neon-violet via-sky-400 to-neon-cyan bg-clip-text text-transparent">aujourd&apos;hui</span> ?
          </h1>
          <p className="text-white/50 mt-3">Choisis ton espace. Tu peux changer en tout temps.</p>
        </section>

        {/* 2 grandes cartes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* FAMILLE — vibrant bleu électrique */}
          <button
            onClick={() => router.push('/dashboard?realm=family')}
            className="group relative rounded-3xl overflow-hidden p-6 sm:p-8 md:p-10 text-left animate-fade-up transition-all hover:scale-[1.02] hover:shadow-2xl"
            style={{ animationDelay: '80ms' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-neon-violet/30 via-sky-500/20 to-neon-cyan/30" />
            <div
              className="absolute inset-0 opacity-30 group-hover:opacity-60 transition-opacity"
              style={{ background: 'radial-gradient(circle at 30% 20%, rgba(41, 208, 254, 0.6), transparent 60%)' }}
            />
            <div className="absolute inset-0 rounded-3xl border border-neon-violet/30 group-hover:border-neon-violet/60 transition-colors" />

            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-violet to-sky-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                <FontAwesomeIcon icon={UI.heartSolid} className="text-white text-2xl" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">Espace</p>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3">
                <span className="bg-gradient-to-r from-neon-violet to-neon-cyan bg-clip-text text-transparent">Famille</span>
              </h2>
              <p className="text-white/70 text-base mb-6 leading-relaxed">
                La vie à la maison. Les enfants, la domotique, les apps de tous les jours.
              </p>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <span className="font-mono">{realmCounts.FAMILY}</span>
                <span>app{realmCounts.FAMILY > 1 ? 's' : ''} disponible{realmCounts.FAMILY > 1 ? 's' : ''}</span>
                <FontAwesomeIcon icon={UI.arrowRight} className="ml-auto text-neon-violet group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* TRAVAIL — zen, sérieux, focus — steel + sky */}
          <button
            onClick={() => router.push('/dashboard?realm=work')}
            className="group relative rounded-3xl overflow-hidden p-6 sm:p-8 md:p-10 text-left animate-fade-up transition-all hover:scale-[1.02]"
            style={{ animationDelay: '160ms' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800/80 via-slate-900/60 to-sky-900/40" />
            <div
              className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
              style={{ background: 'radial-gradient(circle at 70% 30%, rgba(14, 165, 233, 0.4), transparent 60%)' }}
            />
            <div className="absolute inset-0 rounded-3xl border border-slate-400/20 group-hover:border-sky-400/40 transition-colors" />

            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-500 to-sky-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FontAwesomeIcon icon={UI.briefcase} className="text-white text-2xl" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-sky-300/70 mb-2">Espace · Admin</p>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3 text-slate-100">
                Travail
              </h2>
              <p className="text-slate-300/80 text-base mb-6 leading-relaxed font-light">
                Focus. Projets, outils, livrables. Calme et concentré.
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-300/60">
                <span className="font-mono">{realmCounts.WORK}</span>
                <span>projet{realmCounts.WORK > 1 ? 's' : ''}</span>
                <FontAwesomeIcon icon={UI.arrowRight} className="ml-auto text-sky-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-[10px] text-white/25 mt-12 tracking-[0.2em] uppercase">
          Avoine-Blanchette · my-mission-control.com
        </p>
      </div>
    </main>
  );
}
