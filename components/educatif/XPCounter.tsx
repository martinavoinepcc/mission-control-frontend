'use client';

/**
 * <XPCounter> — barre XP animée + affichage niveau courant/suivant.
 */

import { useEffect, useState } from 'react';
import {
  getTotalXp,
  getCurrentLevel,
  getNextLevel,
  getCurrentUsername,
} from '@/lib/educatif/progress';

interface Props {
  /** Force un refresh (ex: incrémenter pour re-lire après un gain d'XP) */
  refreshKey?: number;
}

export default function XPCounter({ refreshKey = 0 }: Props) {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(getCurrentLevel(''));
  const [next, setNext] = useState(getNextLevel(''));

  useEffect(() => {
    const username = getCurrentUsername();
    if (!username) return;
    setXp(getTotalXp(username));
    setLevel(getCurrentLevel(username));
    setNext(getNextLevel(username));
  }, [refreshKey]);

  const toNext = next ? next.minXp - xp : 0;
  const pctInLevel = next
    ? ((xp - level.minXp) / (next.minXp - level.minXp)) * 100
    : 100;

  return (
    <div className="w-full bg-slate-900/60 rounded-2xl p-4 flex flex-col gap-2 border border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{level.emoji}</span>
          <div>
            <div className="text-sm font-bold text-white">
              Niveau {level.id} · {level.name}
            </div>
            <div className="text-xs text-white/60">{xp} XP au total</div>
          </div>
        </div>
        {next && (
          <div className="text-right">
            <div className="text-[10px] text-white/50 uppercase tracking-wide">
              Prochain
            </div>
            <div className="text-sm font-bold text-white">
              {next.emoji} {next.name}
            </div>
          </div>
        )}
      </div>

      <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(pctInLevel, 100)}%`,
            background: 'linear-gradient(90deg, #10B981, #34D399)',
          }}
        />
      </div>

      {next && (
        <div className="text-xs text-white/60 text-right">
          {toNext} XP pour monter de niveau
        </div>
      )}
    </div>
  );
}
