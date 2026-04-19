'use client';

import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';

export default function ImproHubPage() {
  const router = useRouter();

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 cosmic-grid opacity-60" />
      <div className="blob bg-rose-500 w-[420px] h-[420px] -top-48 -left-40 animate-pulse-slow opacity-[0.10]" />
      <div className="blob bg-blue-500 w-[340px] h-[340px] -bottom-32 -right-32 animate-pulse-slow opacity-[0.10]" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <header className="flex items-center justify-between mb-8">
          <button onClick={() => router.push('/apps/educatif')} className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
            <FontAwesomeIcon icon={UI.back} /> Éducatif
          </button>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <FontAwesomeIcon icon={UI.masks} className="text-rose-400" />
            <span className="font-display">Impro Engine</span>
          </div>
        </header>

        <section className="mb-10 animate-fade-up">
          <h1 className="font-display text-3xl sm:text-5xl font-bold mb-2">
            <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">Impro Engine</span>
          </h1>
          <p className="text-white/50 mb-2">Génère des impros, roule des pratiques, tiens un match complet.</p>
          <p className="font-mono text-[11px] text-white/40 tracking-wider">Style LNI Québec · 25 catégories · 60 thèmes · 18 contraintes</p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* PRATIQUE */}
          <button
            onClick={() => router.push('/apps/educatif/impro/practice')}
            className="group relative rounded-3xl overflow-hidden p-6 sm:p-8 md:p-10 text-left animate-fade-up transition-all hover:scale-[1.02] hover:shadow-2xl"
            style={{ animationDelay: '80ms' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/25 via-rose-400/15 to-orange-400/20" />
            <div className="absolute inset-0 rounded-3xl border border-rose-400/30 group-hover:border-rose-400/60 transition-colors" />
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-lg">
                <FontAwesomeIcon icon={UI.dice} className="text-white text-xl sm:text-2xl" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-rose-200/80 mb-2">Mode 1</p>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3 text-rose-100">Pratique</h2>
              <p className="text-white/70 text-base mb-6 leading-relaxed">
                Une carte, un timer, une cloche. Parfait pour warm-up ou pratique d'équipe.
              </p>
              <div className="flex items-center gap-2 text-sm text-rose-200/80">
                <span className="font-mono">Entrer</span>
                <FontAwesomeIcon icon={UI.arrowRight} className="ml-auto text-rose-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* MATCH */}
          <button
            onClick={() => router.push('/apps/educatif/impro/game')}
            className="group relative rounded-3xl overflow-hidden p-6 sm:p-8 md:p-10 text-left animate-fade-up transition-all hover:scale-[1.02] hover:shadow-2xl"
            style={{ animationDelay: '160ms' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 via-slate-800/40 to-slate-900/60" />
            <div className="absolute inset-0 rounded-3xl border border-blue-400/30 group-hover:border-blue-400/60 transition-colors" />
            <div className="relative">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-lg">
                <FontAwesomeIcon icon={UI.trophy} className="text-white text-xl sm:text-2xl" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-blue-200/80 mb-2">Mode 2</p>
              <h2 className="text-3xl sm:text-4xl font-bold font-display mb-3 text-blue-100">Match</h2>
              <p className="text-white/70 text-base mb-6 leading-relaxed">
                2 équipes, rounds, score, votes A/B/Égalité. Écran final avec gagnant.
              </p>
              <div className="flex items-center gap-2 text-sm text-blue-200/80">
                <span className="font-mono">Entrer</span>
                <FontAwesomeIcon icon={UI.arrowRight} className="ml-auto text-blue-300 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
