'use client';

/**
 * <LessonShell> — conteneur d'une leçon : header + progress bar + nav prev/next.
 *
 * Utilisé par chaque page module (ex: P01 Téléchargement). Le contenu des
 * scènes est passé via `children` — le shell ne sait pas ce qu'est une scène,
 * il orchestre juste la nav et la progress bar.
 */

import { ReactNode } from 'react';
import type { SceneType } from '@/lib/educatif/types';

const SCENE_ORDER: SceneType[] = ['hook', 'concept', 'examples', 'try-it', 'recap'];
const SCENE_LABELS: Record<SceneType, string> = {
  hook: 'Intro',
  concept: 'Concept',
  examples: 'Exemples',
  'try-it': 'Essaie',
  recap: 'Bravo',
};

interface Props {
  moduleTitle: string;
  currentScene: SceneType;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  accentColor?: string;
  children: ReactNode;
}

export default function LessonShell({
  moduleTitle,
  currentScene,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  accentColor = '#10B981',
  children,
}: Props) {
  const currentIdx = SCENE_ORDER.indexOf(currentScene);
  const progressPct = ((currentIdx + 1) / SCENE_ORDER.length) * 100;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          'linear-gradient(180deg, #0a1628 0%, #0f2847 50%, #0a1628 100%)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Header + progress bar (sticky mobile) */}
      <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur border-b border-white/10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <a
              href="/apps/educatif/"
              className="min-h-[44px] flex items-center text-sm text-white/70 hover:text-white touch-manipulation"
            >
              ← Éducatif
            </a>
            <h1 className="text-base sm:text-lg font-bold text-center flex-1 truncate">
              {moduleTitle}
            </h1>
            <span className="text-xs text-white/60 min-w-[50px] text-right">
              {currentIdx + 1}/{SCENE_ORDER.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%`, backgroundColor: accentColor }}
            />
          </div>

          {/* Scene labels */}
          <div className="flex items-center justify-between text-[10px] sm:text-xs font-semibold">
            {SCENE_ORDER.map((s, i) => (
              <span
                key={s}
                className={
                  i <= currentIdx ? 'text-white' : 'text-white/40'
                }
                style={i === currentIdx ? { color: accentColor } : undefined}
              >
                {SCENE_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-4 py-6 pb-32 sm:pb-24">
        {children}
      </main>

      {/* Nav prev/next (fixed bottom on mobile) */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-slate-950/90 backdrop-blur border-t border-white/10">
        <div
          className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={onPrev}
            disabled={!canPrev || !onPrev}
            className="min-h-[48px] px-4 sm:px-6 rounded-full bg-white/10 text-white font-semibold text-sm sm:text-base touch-manipulation hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Précédent
          </button>
          <button
            onClick={onNext}
            disabled={!canNext || !onNext}
            className="min-h-[48px] px-4 sm:px-6 rounded-full font-bold text-sm sm:text-base text-white touch-manipulation disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: accentColor }}
          >
            Suivant →
          </button>
        </div>
      </footer>
    </div>
  );
}
