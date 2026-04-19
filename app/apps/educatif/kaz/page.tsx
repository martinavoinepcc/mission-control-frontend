'use client';

// Hub Kaz & Moi — niveaux progressifs de coding avec Kaz (streamer Twitch).
// S1 unlocked, S2-S4 coming soon (on les débloquera au fur et à mesure).

import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';

type LevelMeta = {
  num: string;
  slug: string | null;
  title: string;
  concept: string;
  color: string;
  ringColor: string;
  emoji: string;
  unlocked: boolean;
};

const LEVELS: LevelMeta[] = [
  {
    num: 'S1',
    slug: 'survie-xp-s1',
    title: 'Survie XP — Variables',
    concept: 'Variables de vie, vitesse, stratégie. Kaz te coach en live.',
    color: 'text-violet-300',
    ringColor: 'border-violet-400/50',
    emoji: '🎮',
    unlocked: true,
  },
  {
    num: 'S2',
    slug: 'survie-xp-s2',
    title: 'Le cookie qui soigne',
    concept: 'Conditions if/else avec Kaz en live.',
    color: 'text-pink-300',
    ringColor: 'border-pink-400/50',
    emoji: '🍪',
    unlocked: true,
  },
  {
    num: 'S3',
    slug: null,
    title: 'À venir',
    concept: 'Loops (for / while) — Coming soon.',
    color: 'text-cyan-300',
    ringColor: 'border-cyan-400/30',
    emoji: '🔁',
    unlocked: false,
  },
  {
    num: 'S4',
    slug: null,
    title: 'À venir',
    concept: 'Fonctions + modularité — Coming soon.',
    color: 'text-amber-300',
    ringColor: 'border-amber-400/30',
    emoji: '⚡',
    unlocked: false,
  },
];

export default function KazHubPage() {
  const router = useRouter();

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 cosmic-grid" />
      <div className="blob bg-violet-500 w-[420px] h-[420px] -top-48 -right-40 animate-pulse-slow opacity-[0.10]" />
      <div className="blob bg-pink-400 w-[340px] h-[340px] -bottom-32 -left-32 animate-pulse-slow opacity-[0.08]" style={{ animationDelay: '2.5s' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/apps/educatif')}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm"
          >
            <FontAwesomeIcon icon={UI.back} /> Éducatif
          </button>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <FontAwesomeIcon icon={UI.graduationCap} className="text-violet-400" />
            <span className="font-display">Kaz &amp; Moi</span>
          </div>
        </header>

        {/* HERO */}
        <section className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
            <span className="grad-text">Kaz</span> &amp; Moi
          </h1>
          <p className="text-white/50 mb-2">
            Kaz streame, tu codes. Pas de théorie qui endort — des défis où ton code change la game en direct.
          </p>
          <p className="font-mono text-[11px] text-white/40 tracking-wider">
            Format live Twitch · code Java · feedback instantané
          </p>
        </section>

        {/* LEVELS GRID */}
        <section>
          <h2 className="font-display text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-white/80">Les niveaux</span>
            <span className="font-mono text-[10px] text-white/40">progression · 4 séries prévues</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LEVELS.map((lvl, idx) => (
              <LevelCard
                key={lvl.num}
                level={lvl}
                delay={idx * 80}
                onClick={() => {
                  if (lvl.unlocked && lvl.slug) {
                    router.push(`/apps/educatif/kaz/${lvl.slug}`);
                  }
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function LevelCard({
  level,
  delay,
  onClick,
}: {
  level: LevelMeta;
  delay: number;
  onClick: () => void;
}) {
  const locked = !level.unlocked;
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={`group text-left rounded-xl overflow-hidden glass p-5 border transition-all animate-fade-up ${level.ringColor} ${
        locked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] hover:border-opacity-100'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-11 h-11 rounded-md bg-slate-800/60 border ${level.ringColor} flex items-center justify-center text-xl`}
        >
          {level.emoji}
        </div>
        <div className={`font-mono text-[10px] tracking-widest ${level.color} font-black`}>
          {level.num}
        </div>
      </div>
      <h3 className="font-display text-base font-bold mb-1.5">{level.title}</h3>
      <p className="font-mono text-[10px] text-white/40 leading-relaxed">{level.concept}</p>
      <div
        className={`mt-3 font-mono text-[10px] ${
          locked ? 'text-white/30' : `${level.color} opacity-0 group-hover:opacity-100 transition`
        }`}
      >
        {locked ? '🔒 LOCKED' : '▶ ENTER'}
      </div>
    </button>
  );
}
