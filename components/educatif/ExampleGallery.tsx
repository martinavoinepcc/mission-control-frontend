'use client';

/**
 * <ExampleGallery> — 3 cartes cliquables. Au tap, la carte s'ouvre
 * et l'avatar lit le détail (via AvatarScene si detailVideo fournie).
 *
 * Jackson-friendly : pas de lecture obligée, avatar lit tout.
 */

import { useState } from 'react';
import type { ExampleItem } from '@/lib/educatif/types';
import AvatarScene from './AvatarScene';

interface Props {
  items: ExampleItem[];
  /** Appelé quand tous les items ont été ouverts au moins une fois */
  onAllOpened?: () => void;
  accentColor?: string;
}

export default function ExampleGallery({
  items,
  onAllOpened,
  accentColor = '#10B981',
}: Props) {
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleOpen = (id: string) => {
    const next = new Set(opened);
    next.add(id);
    setOpened(next);
    setActiveId(id);
    if (next.size === items.length && opened.size < items.length) {
      onAllOpened?.();
    }
  };

  const active = items.find(it => it.id === activeId) || null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {items.map(item => {
          const isOpen = opened.has(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleOpen(item.id)}
              className="relative rounded-2xl p-4 sm:p-5 text-left touch-manipulation min-h-[120px] flex flex-col gap-2"
              style={{
                background: isOpen
                  ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`
                  : 'linear-gradient(135deg, #1e293b, #0f172a)',
                border: `2px solid ${isOpen ? accentColor : '#334155'}`,
                transition: 'all 0.25s',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{item.emoji}</span>
                {isOpen && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: accentColor, color: '#0a1628' }}
                  >
                    ✓ VU
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold text-white">{item.title}</h4>
              <p className="text-sm text-white/70 line-clamp-2">
                {item.shortText}
              </p>
            </button>
          );
        })}
      </div>

      {/* Détail de l'exemple actif */}
      {active && (
        <div
          className="rounded-2xl p-4 sm:p-6 flex flex-col gap-4"
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: `2px solid ${accentColor}`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-lg sm:text-xl font-bold text-white">
              {active.emoji} {active.title}
            </h4>
            <button
              onClick={() => setActiveId(null)}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-white/10 text-white touch-manipulation hover:bg-white/20"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          {active.detailVideo && (
            <AvatarScene video={active.detailVideo} accentColor={accentColor} />
          )}

          <p className="text-base sm:text-lg text-white/90 leading-relaxed">
            {active.detailText}
          </p>
        </div>
      )}

      {/* Hint pour avancer */}
      <div className="text-center text-sm text-white/60">
        {opened.size}/{items.length} exemples ouverts
        {opened.size < items.length && ' — ouvre-les tous pour continuer'}
      </div>
    </div>
  );
}
