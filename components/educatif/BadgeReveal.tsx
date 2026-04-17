'use client';

/**
 * <BadgeReveal> — animation confetti CSS + son optionnel à l'obtention d'un badge.
 *
 * Zéro dépendance externe (pas de canvas-confetti) : confetti via DOM + CSS
 * pour rester léger sur mobile.
 */

import { useEffect, useRef, useState } from 'react';
import type { Badge } from '@/lib/educatif/types';

interface Props {
  badge: Badge;
  /** Joue le son (si le navigateur permet l'autoplay audio) */
  playSound?: boolean;
  /** Affiche le composant (permet le reveal au bon moment) */
  show: boolean;
  onDone?: () => void;
}

const CONFETTI_COLORS = [
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#3B82F6',
  '#A78BFA',
  '#FBBF24',
];

export default function BadgeReveal({
  badge,
  playSound = true,
  show,
  onDone,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [pieces] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 1.5 + Math.random() * 1.5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360,
    }))
  );

  useEffect(() => {
    if (!show) return;
    if (playSound && audioRef.current) {
      audioRef.current.play().catch(() => {
        /* autoplay block — ok, pas critique */
      });
    }
  }, [show, playSound]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-100vh) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(110vh)  rotate(720deg); opacity: 0; }
        }
        @keyframes badge-pop {
          0%   { transform: scale(0) rotate(-180deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0);        opacity: 1; }
        }
      `}</style>

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map(p => (
          <span
            key={p.id}
            className="absolute w-2.5 h-2.5 rounded-sm"
            style={{
              left: `${p.left}%`,
              top: '-10px',
              backgroundColor: p.color,
              animation: `confetti-fall ${p.duration}s ${p.delay}s ease-out forwards`,
              transform: `rotate(${p.rotate}deg)`,
            }}
          />
        ))}
      </div>

      {/* Badge card */}
      <div
        className="relative w-full max-w-sm rounded-3xl p-6 sm:p-8 flex flex-col items-center gap-4 shadow-2xl"
        style={{
          background:
            'linear-gradient(160deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98))',
          border: `3px solid ${badge.color}`,
          boxShadow: `0 0 40px ${badge.color}80`,
          animation: 'badge-pop 0.6s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <span className="text-[10px] font-bold tracking-widest text-white/60">
          NOUVEAU BADGE
        </span>
        <div
          className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-6xl sm:text-7xl"
          style={{
            background: `radial-gradient(circle, ${badge.color}40, transparent)`,
            boxShadow: `0 0 30px ${badge.color}`,
          }}
        >
          {badge.emoji}
        </div>
        <h3 className="text-2xl font-bold text-white text-center">
          {badge.name}
        </h3>
        <p className="text-base text-white/80 text-center leading-snug">
          {badge.description}
        </p>
        <button
          onClick={onDone}
          className="min-h-[48px] w-full rounded-full font-bold text-white text-base touch-manipulation"
          style={{ backgroundColor: badge.color }}
        >
          Trop cool, continuer →
        </button>
      </div>

      {/* Son succès — un simple ding WAV hébergé ; on laisse vide par défaut */}
      {playSound && (
        <audio ref={audioRef} preload="auto">
          <source src="/sounds/badge.mp3" type="audio/mpeg" />
        </audio>
      )}
    </div>
  );
}
