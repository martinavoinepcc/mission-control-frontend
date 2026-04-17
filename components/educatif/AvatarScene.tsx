'use client';

/**
 * <AvatarScene> — Player vidéo HeyGen avec sous-titres, replay, vitesse.
 *
 * Cœur du design Jackson : toute info lue par un avatar, jamais d'obligation
 * de lire. Sous-titres activés par défaut (aide l'association son/mot).
 *
 * Mobile-first : boutons ≥ 48 px, pas de scroll horizontal, safe-area.
 */

import { useEffect, useRef, useState } from 'react';
import type { AvatarVideo } from '@/lib/educatif/types';

interface Props {
  video: AvatarVideo;
  /** Appelé quand la vidéo atteint la fin */
  onEnded?: () => void;
  /** Autoplay au montage (défaut : true) */
  autoPlay?: boolean;
  /** Titre optionnel affiché au-dessus du player */
  title?: string;
  /** Couleur d'accent (défaut : vert Éducatif #10B981) */
  accentColor?: string;
}

export default function AvatarScene({
  video,
  onEnded,
  autoPlay = true,
  title,
  accentColor = '#10B981',
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [showCaptions, setShowCaptions] = useState(true);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);

  // Gérer les changements de video.src (changement de scène)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = 0;
    setEnded(false);
    setProgress(0);
    if (autoPlay) el.play().catch(() => setPlaying(false));
  }, [video.src, autoPlay]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.playbackRate = rate;
  }, [rate]);

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const replay = () => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = 0;
    el.play();
    setPlaying(true);
    setEnded(false);
  };

  const cycleRate = () => {
    const next = rate === 1 ? 0.75 : rate === 0.75 ? 1.25 : 1;
    setRate(next);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {title && (
        <h3
          className="text-lg sm:text-xl font-bold text-white"
          style={{ textShadow: `0 0 8px ${accentColor}40` }}
        >
          {title}
        </h3>
      )}

      <div
        className="relative w-full rounded-2xl overflow-hidden bg-slate-900 shadow-2xl"
        style={{ boxShadow: `0 0 24px ${accentColor}30` }}
      >
        <video
          ref={ref}
          src={video.src}
          className="w-full h-auto max-h-[60vh] object-contain bg-black"
          playsInline
          onEnded={() => {
            setPlaying(false);
            setEnded(true);
            onEnded?.();
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
          }}
          onClick={togglePlay}
        />

        {/* Overlay captions */}
        {showCaptions && (
          <div className="absolute bottom-20 left-0 right-0 px-4 pointer-events-none">
            <p className="mx-auto max-w-3xl text-center text-base sm:text-lg font-semibold text-white bg-black/70 rounded-lg px-4 py-2">
              {video.captions}
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="absolute bottom-14 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full transition-all duration-150"
            style={{ width: `${progress}%`, backgroundColor: accentColor }}
          />
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-t from-black/90 to-transparent">
          <button
            onClick={togglePlay}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full bg-white/90 text-slate-900 text-xl font-bold touch-manipulation hover:bg-white"
            aria-label={playing ? 'Pause' : 'Lecture'}
          >
            {playing ? '⏸' : '▶'}
          </button>

          <button
            onClick={replay}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full bg-white/20 text-white text-lg touch-manipulation hover:bg-white/30"
            aria-label="Rejouer"
          >
            ↻
          </button>

          <button
            onClick={cycleRate}
            className="min-h-[48px] px-3 rounded-full bg-white/20 text-white text-sm font-bold touch-manipulation hover:bg-white/30"
            aria-label="Vitesse de lecture"
          >
            {rate}×
          </button>

          <button
            onClick={() => setShowCaptions(!showCaptions)}
            className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full text-sm font-bold touch-manipulation ${
              showCaptions ? 'bg-white text-slate-900' : 'bg-white/20 text-white'
            }`}
            aria-label="Afficher les sous-titres"
          >
            CC
          </button>
        </div>

        {/* Fin de scène — CTA rejouer */}
        {ended && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <button
              onClick={replay}
              className="px-6 py-3 rounded-full text-white font-bold text-lg touch-manipulation"
              style={{ backgroundColor: accentColor }}
            >
              ↻ Rejouer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
