'use client';

/**
 * /apps/educatif/minecraft/ — Index des modules Codeur Minecraft pour Jackson.
 *
 * Affiche les 8 leçons du parcours Master Codeur. Seul P01 est actif au pilote ;
 * les autres sont verrouillés (ouvrent un message "Bientôt disponible").
 */

import { useEffect, useState } from 'react';
import {
  getCurrentUsername,
  getModuleProgress,
} from '@/lib/educatif/progress';
import XPCounter from '@/components/educatif/XPCounter';
import ProgressMap from '@/components/educatif/ProgressMap';

type Module = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  emoji: string;
  active: boolean;
};

const MODULES: Module[] = [
  { id: 'p01', slug: 'p01-telechargement', title: 'P01 — Téléchargement',     subtitle: 'Installer Minecraft Java Edition',       emoji: '📥', active: true  },
  { id: 'p02', slug: 'p02-multijoueur',    title: 'P02 — Multijoueur',        subtitle: 'Configurer le jeu et le mode online',    emoji: '🌐', active: false },
  { id: 'm01', slug: 'm01-redstone',       title: 'Module 1 — Redstone',      subtitle: 'Découvre la redstone, le circuit magique', emoji: '🔴', active: false },
  { id: 'm02', slug: 'm02-courant',        title: 'Module 2 — Courant',       subtitle: 'Puissance et propagation',               emoji: '⚡', active: false },
  { id: 'm03', slug: 'm03-logique',        title: 'Module 3 — Logique',       subtitle: 'Vrai / faux, ET, OU, NON',               emoji: '🧠', active: false },
  { id: 'm04', slug: 'm04-pistons',        title: 'Module 4 — Pistons',       subtitle: 'Timing et mouvement',                    emoji: '🕹️', active: false },
  { id: 'm05', slug: 'm05-mise-en-commun', title: 'Module 5 — Mise en commun', subtitle: 'Fusionne tout dans un projet',          emoji: '🏗️', active: false },
  { id: 'final', slug: 'final',            title: 'Défi final',               subtitle: 'Prouve que t\'es Master Codeur',         emoji: '🏆', active: false },
];

export default function MinecraftIndexPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [username, setUsername] = useState<string | null>(null);
  const [moduleStatus, setModuleStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const u = getCurrentUsername();
    if (!u) {
      window.location.href = '/';
      return;
    }
    setUsername(u);
    const status: Record<string, boolean> = {};
    MODULES.forEach(m => {
      const p = getModuleProgress(u, m.id);
      status[m.id] = !!p.completedAt;
    });
    setModuleStatus(status);
    setRefreshKey(k => k + 1);
  }, []);

  if (!username) return null;

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
      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur border-b border-white/10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <a
            href="/apps/educatif/"
            className="min-h-[44px] flex items-center text-sm text-white/70 hover:text-white touch-manipulation"
          >
            ← Éducatif
          </a>
          <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <span className="text-2xl">⛏️</span>
            <span>Codeur Minecraft</span>
          </h1>
          <span className="text-xs text-white/60 min-w-[44px] text-right">
            {Object.values(moduleStatus).filter(Boolean).length}/{MODULES.length}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-6">
        {/* Bandeau XP + carte */}
        <XPCounter refreshKey={refreshKey} />

        <section>
          <h2 className="text-sm font-bold text-white/70 mb-3 uppercase tracking-wide">
            Ta route de Master Codeur
          </h2>
          <ProgressMap refreshKey={refreshKey} />
        </section>

        {/* Liste des modules */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide">
            Les leçons
          </h2>

          {MODULES.map(m => {
            const done = moduleStatus[m.id];
            const locked = !m.active;
            const content = (
              <div
                className={`rounded-2xl p-4 sm:p-5 flex items-center gap-4 border-2 ${
                  done
                    ? 'bg-emerald-500/10 border-emerald-500'
                    : m.active
                    ? 'bg-slate-800/60 border-emerald-500/40'
                    : 'bg-slate-900/40 border-white/5 opacity-60'
                }`}
              >
                <div className="text-3xl sm:text-4xl w-14 h-14 flex items-center justify-center rounded-xl bg-white/5">
                  {m.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-white truncate">
                      {m.title}
                    </h3>
                    {done && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-900">
                        ✓ FAIT
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/70 truncate">{m.subtitle}</p>
                </div>
                <div className="text-white/60 text-lg">
                  {locked ? '🔒' : '→'}
                </div>
              </div>
            );

            return m.active ? (
              <a
                key={m.id}
                href={`/apps/educatif/minecraft/${m.slug}/`}
                className="touch-manipulation"
              >
                {content}
              </a>
            ) : (
              <button
                key={m.id}
                type="button"
                disabled
                className="text-left cursor-not-allowed"
                aria-disabled
                title="Bientôt disponible — termine d'abord les leçons précédentes"
              >
                {content}
              </button>
            );
          })}
        </section>

        <p className="text-center text-xs text-white/40 mt-4">
          Parcours préparé pour le camp Silica Studio — été 2026
        </p>
      </main>
    </div>
  );
}
