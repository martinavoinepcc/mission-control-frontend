'use client';

// Hub Éducatif — liste les modules accessibles, affiche le rang et l'XP de l'utilisateur.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  getEduModules,
  getEduMe,
  clearToken,
  type EduModuleSummary,
  type EduMeStats,
} from '@/lib/api';
import { UI } from '@/lib/icons';

export default function EducatifHubPage() {
  const router = useRouter();
  const [modules, setModules] = useState<EduModuleSummary[]>([]);
  const [stats, setStats] = useState<EduMeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([getEduModules(), getEduMe()]);
        setModules(m.modules);
        setStats(s);
      } catch (err: any) {
        if (err.message.includes('Session') || err.message.includes('Authentification')) {
          clearToken();
          router.push('/');
          return;
        }
        setError(err.message || 'Erreur lors du chargement.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 cosmic-grid" />
        <FontAwesomeIcon icon={UI.spinner} className="text-neon-cyan text-3xl animate-spin" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 cosmic-grid" />
      <div className="blob bg-emerald-500 w-[500px] h-[500px] -top-40 -right-32 animate-pulse-slow opacity-20" />
      <div className="blob bg-neon-cyan w-[400px] h-[400px] -bottom-24 -left-24 animate-pulse-slow opacity-15" style={{ animationDelay: '2.5s' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm"
          >
            <FontAwesomeIcon icon={UI.back} /> Retour
          </button>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <FontAwesomeIcon icon={UI.graduationCap} className="text-emerald-400" />
            <span className="font-display">Éducatif</span>
          </div>
        </header>

        {error && (
          <div className="glass rounded-xl p-4 mb-6 text-sm text-red-300 border border-red-500/30">
            <FontAwesomeIcon icon={UI.warning} className="mr-2" />
            {error}
          </div>
        )}

        {/* Rang + Stats */}
        {stats && (
          <section className="glass rounded-2xl p-6 mb-8 border border-emerald-500/20 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/40 mb-1">Rang actuel</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                    <FontAwesomeIcon icon={UI.crown} className="text-white text-lg" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold text-emerald-300">{stats.rank.label}</h2>
                    <p className="text-white/50 text-sm">{stats.totalXp} XP · {stats.completedCount} missions complétées</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Stat icon={UI.star} value={stats.totalStars} label="étoiles" color="#FBBF24" />
                <Stat icon={UI.bolt} value={stats.totalXp} label="XP" color="#06B6D4" />
                <Stat icon={UI.medal} value={stats.badges.length} label="badges" color="#A855F7" />
              </div>
            </div>
          </section>
        )}

        {/* Modules */}
        <section className="mb-4">
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
            Tes <span className="grad-text">modules</span>
          </h1>
          <p className="text-white/50 mb-8">Chaque module est une aventure complète. Clique pour entrer.</p>

          {modules.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-white/50">
              Aucun module assigné pour le moment. Demande à un parent admin de t'en débloquer un.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {modules.map((m, idx) => (
                <ModuleCard key={m.id} mod={m} delay={idx * 100} onClick={() => router.push(`/apps/educatif/module/?slug=${m.slug}`)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <FontAwesomeIcon icon={icon} style={{ color }} className="text-lg mb-0.5" />
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}

function ModuleCard({ mod, delay, onClick }: { mod: EduModuleSummary; delay: number; onClick: () => void }) {
  const color = mod.coverColor || '#4ADE80';
  const progressPct = mod.totalLessons ? Math.round((mod.completedLessons / mod.totalLessons) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className="group relative text-left rounded-2xl overflow-hidden glass p-6 transition-all hover:scale-[1.015] hover:shadow-2xl animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="absolute inset-0 opacity-20 group-hover:opacity-35 transition"
        style={{ background: `radial-gradient(circle at 25% 20%, ${color}, transparent 70%)` }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl transition-transform group-hover:scale-110"
            style={{ background: `${color}25`, border: `1px solid ${color}55` }}
          >
            <FontAwesomeIcon icon={UI.gem} className="text-2xl" style={{ color }} />
          </div>
          <div className="flex items-center gap-1 text-sm">
            <FontAwesomeIcon icon={UI.star} className="text-amber-400" />
            <span className="font-display font-semibold">{mod.starsEarned}</span>
          </div>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Module · v{mod.version}</p>
        <h3 className="font-display text-xl font-bold mb-1">{mod.title}</h3>
        {mod.subtitle && <p className="text-white/70 text-sm mb-3">{mod.subtitle}</p>}
        {mod.description && <p className="text-white/50 text-xs mb-4 line-clamp-2">{mod.description}</p>}

        {/* Progress bar */}
        <div className="flex items-center justify-between text-xs text-white/60 mb-1">
          <span>{mod.completedLessons} / {mod.totalLessons} missions</span>
          <span className="font-display font-semibold" style={{ color }}>{progressPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${progressPct}%`, background: color }} />
        </div>
      </div>
    </button>
  );
}
