'use client';

/**
 * <ConceptCard> — carte d'idée clé flippable.
 *
 * Face avant : emoji + titre.
 * Face arrière : explication courte.
 * Tap/clic pour flipper. Touch target 100%.
 */

import { useState } from 'react';

interface Props {
  emoji: string;
  title: string;
  backText: string;
  accentColor?: string;
}

export default function ConceptCard({
  emoji,
  title,
  backText,
  accentColor = '#10B981',
}: Props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      onClick={() => setFlipped(!flipped)}
      className="relative w-full min-h-[180px] sm:min-h-[220px] rounded-2xl overflow-hidden touch-manipulation"
      style={{
        background: flipped
          ? `linear-gradient(135deg, ${accentColor}20, ${accentColor}50)`
          : 'linear-gradient(135deg, #1e293b, #0f172a)',
        border: `2px solid ${accentColor}`,
        boxShadow: `0 0 20px ${accentColor}30`,
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}
      aria-label={flipped ? 'Voir le recto' : 'Voir l\'explication'}
    >
      {!flipped ? (
        <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
          <span className="text-5xl sm:text-6xl">{emoji}</span>
          <h3 className="text-lg sm:text-xl font-bold text-white text-center">
            {title}
          </h3>
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: `${accentColor}30`, color: accentColor }}
          >
            Tap pour savoir pourquoi
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full p-6 gap-3">
          <p className="text-base sm:text-lg text-white text-center leading-snug">
            {backText}
          </p>
          <span className="text-xs text-white/60">Tap pour revenir</span>
        </div>
      )}
    </button>
  );
}
