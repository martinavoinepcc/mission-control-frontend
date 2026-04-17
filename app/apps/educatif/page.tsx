'use client';

// Hub Éducatif v3 — MCreator Academy only (Code Cadet scrapé).
// Hero card + grille de 5 missions (Block / Item / Mob / Procedure / Recipe).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  getEduMe,
  clearToken,
  type EduMeStats,
} from '@/lib/api';
import { UI } from '@/lib/icons';

type MissionMeta = {
  num: string;
  slug: string;
  title: string;
  category: string;
  emoji: string;
  color: string;
  ringColor: string;
  concept: string;
};

const MISSIONS: MissionMeta[] = [
  {
    num: '01', slug: 'mission-1-bloc-cookie', title: 'Crée ton Block', category: 'Block',
    emoji: '🟩', color: 'text-lime-300', ringColor: 'border-lime-400/50',
    concept: 'Block.Properties · héritage · @Override',
  },
  {
    num: '02', slug: 'mission-2-epee-custom', title: 'Forge ton Item', category: 'Item',
    emoji: '⚔️', color: 'text-fuchsia-300', ringColor: 'border-fuchsia-400/50',
    concept: 'extends SwordItem · enum Tier · super(...)',
  },
  {
    num: '03', slug: 'mission-3-mob-custom', title: 'Spawn ton Mob', category: 'Mob',
    emoji: '🐺', color: 'text-rose-300', ringColor: 'border-rose-400/50',
    concept: 'extends Monster · Builder · registerGoals',
  },
  {
    num: '04', slug: 'mission-4-procedure', title: 'Code une Procedure', category: 'Procedure',
    emoji: '⚙️', color: 'text-cyan-300', ringColor: 'border-cyan-400/50',
    concept: '@SubscribeEvent · if/&& · static method',
  },
  {
    num: '05', slug: 'mission-5-recipe', title: 'Forge une Recipe', category: 'Recipe',
    emoji: '🔨', color: 'text-amber-300', ringColor: 'border-amber-400/50',
    concept: 'ShapedRecipeBuilder · pattern · JSON datagen',
  },
];

export default function EducatifHubPage() {
  const router = useRouter();
  const [stats, setStats] = useState<EduMeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getEduMe();
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
      <div className="blob bg-fuchsia-500 w-[420px] h-[420px] -top-48 -right-40 animate-pulse-slow opacity-[0.10]" />
      <div className="blob bg-lime-400 w-[340px] h-[340px] -bottom-32 -left-32 animate-pulse-slow opacity-[0.08]" style={{ animationDelay: '2.5s' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <header className="flex items-center justify-between mb-8">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
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

        {/* HERO MCREATOR ACADEMY */}
        <section className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
            <span className="grad-text">MCreator</span> Academy
          </h1>
          <p className="text-white/50 mb-6">5 missions · prépare-toi au camp Studio XP cet été. Chaque mission = du vrai code Java.</p>

          <button
            onClick={() => router.push('/apps/educatif/mcreator/mission-1-bloc-cookie/')}
            className="group relative w-full text-left rounded-2xl overflow-hidden glass p-6 sm:p-8 border border-fuchsia-500/30 hover:border-fuchsia-400/60 transition-all hover:scale-[1.005] animate-fade-up"
          >
            <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition" style={{ background: 'radial-gradient(circle at 25% 20%, #d946ef, transparent 70%)' }} />
            <div className="relative flex items-center gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center text-3xl sm:text-4xl shadow-lg shadow-fuchsia-500/30 flex-shrink-0">💪</div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-fuchsia-300/80 mb-1 font-mono">Coach K · Sensei Java · v3.0</p>
                <h3 className="font-display text-xl sm:text-2xl font-bold mb-1">Yo Jackson. Let's build a mod.</h3>
                <p className="text-white/60 text-sm">5 missions, du Block au Recipe. Vrai Java. Vrai patterns. Le camp va être easy après ça.</p>
              </div>
              <div className="hidden sm:flex items-center text-fuchsia-300 font-mono text-sm">▶ START M01</div>
            </div>
          </button>
        </section>

        {/* MISSION GRID */}
        <section>
          <h2 className="font-display text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-white/80">Toutes les missions</span>
            <span className="font-mono text-[10px] text-white/40">5 elements · progression libre</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MISSIONS.map((m, idx) => (
              <MissionCard key={m.num} mission={m} delay={idx * 80} onClick={() => router.push(`/apps/educatif/mcreator/${m.slug}/`)} />
            ))}
          </div>
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

function MissionCard({ mission, delay, onClick }: { mission: MissionMeta; delay: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group text-left rounded-xl overflow-hidden glass p-5 border transition-all hover:scale-[1.02] animate-fade-up ${mission.ringColor} hover:border-opacity-100`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-md bg-slate-800/60 border ${mission.ringColor} flex items-center justify-center text-xl`}>{mission.emoji}</div>
        <div className={`font-mono text-[10px] tracking-widest ${mission.color} font-black`}>M{mission.num}</div>
      </div>
      <p className={`text-[10px] uppercase tracking-widest ${mission.color} font-mono mb-1`}>{mission.category}</p>
      <h3 className="font-display text-base font-bold mb-1.5">{mission.title}</h3>
      <p className="font-mono text-[10px] text-white/40 leading-relaxed">{mission.concept}</p>
      <div className={`mt-3 font-mono text-[10px] ${mission.color} opacity-0 group-hover:opacity-100 transition`}>▶ ENTER</div>
    </button>
  );
}
