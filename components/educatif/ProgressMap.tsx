'use client';

/**
 * <ProgressMap> — carte visuelle des niveaux et badges gagnés.
 *
 * Affiche la progression de Jackson sur sa « route Master Codeur ».
 * Mobile : scroll horizontal natif mais sans JS exotique.
 */

import { LEVELS, getTotalXp, getCurrentUsername } from '@/lib/educatif/progress';
import { useEffect, useState } from 'react';

interface Props {
  refreshKey?: number;
}

export default function ProgressMap({ refreshKey = 0 }: Props) {
  const [xp, setXp] = useState(0);

  useEffect(() => {
    const u = getCurrentUsername();
    if (u) setXp(getTotalXp(u));
  }, [refreshKey]);

  return (
    <div className="w-full overflow-x-auto -mx-4 px-4 pb-2">
      <div className="flex items-center gap-3 min-w-max">
        {LEVELS.map((lvl, i) => {
          const reached = xp >= lvl.minXp;
          const isCurrent =
            reached && (i === LEVELS.length - 1 || xp < LEVELS[i + 1].minXp);
          return (
            <div key={lvl.id} className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1 min-w-[80px]">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 ${
                    reached ? 'shadow-lg' : ''
                  }`}
                  style={{
                    background: reached
                      ? 'linear-gradient(135deg, #10B981, #065F46)'
                      : 'rgba(30, 41, 59, 0.6)',
                    borderColor: isCurrent ? '#FBBF24' : reached ? '#10B981' : '#334155',
                    boxShadow: isCurrent
                      ? '0 0 20px #FBBF24'
                      : reached
                      ? '0 0 14px #10B98160'
                      : 'none',
                    opacity: reached ? 1 : 0.4,
                  }}
                >
                  {lvl.emoji}
                </div>
                <div className="text-[11px] font-bold text-center text-white">
                  {lvl.name}
                </div>
                <div className="text-[10px] text-white/60">{lvl.minXp} XP</div>
              </div>
              {i < LEVELS.length - 1 && (
                <div
                  className="h-1 w-8 rounded"
                  style={{
                    backgroundColor:
                      xp >= LEVELS[i + 1].minXp ? '#10B981' : '#334155',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
