'use client';

/**
 * /apps/educatif/minecraft/ — Index du parcours Codeur Minecraft de Jackson.
 *
 * Aligné EXACTEMENT sur le curriculum Silica Studio :
 *   - Préparation (logistique, à faire avec papa)
 *   - Cours 0 : bases in-game (bouger, poser, interagir)
 *   - Fondations Redstone : 5 modules miroir du camp
 *   - Défi Master Codeur (custom, après le camp)
 *
 * Seul le pilote Fondations M1 — Découverte de la Redstone est actif.
 * Les autres modules sont verrouillés jusqu'à validation du pilote avec Jackson.
 */

import { useEffect, useState } from 'react';
import {
  getCurrentUsername,
  getModuleProgress,
} from '@/lib/educatif/progress';
import XPCounter from '@/components/educatif/XPCounter';
import ProgressMap from '@/components/educatif/ProgressMap';

type Section = 'prep' | 'cours0' | 'redstone' | 'defi';

type Module = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  emoji: string;
  section: Section;
  active: boolean;
};

const MODULES: Module[] = [
  // ── Cours 0 : bases in-game ──
  {
    id: 'c0m1',
    slug: 'cours0-bouger',
    title: 'Cours 0 · M1 — Bouge dans le monde',
    subtitle: 'Déplacement, caméra, sauter, courir',
    emoji: '🚶',
    section: 'cours0',
    active: false,
  },
  {
    id: 'c0m2',
    slug: 'cours0-poser-casser',
    title: 'Cours 0 · M2 — Pose et casse',
    subtitle: 'Blocs, clic gauche/droit, inventaire',
    emoji: '🧱',
    section: 'cours0',
    active: false,
  },
  {
    id: 'c0m3',
    slug: 'cours0-interagir',
    title: 'Cours 0 · M3 — Interagis',
    subtitle: 'Panneaux, coffres, objets, crafting simple',
    emoji: '🤝',
    section: 'cours0',
    active: false,
  },

  // ── Fondations Redstone ──
  {
    id: 'rsm1',
    slug: 'redstone-m1-decouverte',
    title: 'Fondations M1 — Découverte',
    subtitle: 'Source, fil, cible — le cœur de la Redstone',
    emoji: '⚡',
    section: 'redstone',
    active: true, // ← PILOTE
  },
  {
    id: 'rsm2',
    slug: 'redstone-m2-puissance',
    title: 'Fondations M2 — Puissance',
    subtitle: "Jusqu'où le signal peut voyager",
    emoji: '🔋',
    section: 'redstone',
    active: false,
  },
  {
    id: 'rsm3',
    slug: 'redstone-m3-logique',
    title: 'Fondations M3 — Logique booléenne',
    subtitle: 'Portes ET, OU, NON',
    emoji: '🧠',
    section: 'redstone',
    active: false,
  },
  {
    id: 'rsm4',
    slug: 'redstone-m4-timing',
    title: 'Fondations M4 — Pistons & timing',
    subtitle: 'Délais, répéteurs, mouvement',
    emoji: '⏱️',
    section: 'redstone',
    active: false,
  },
  {
    id: 'rsm5',
    slug: 'redstone-m5-mise-en-commun',
    title: 'Fondations M5 — Mise en commun',
    subtitle: 'Construis ta première vraie machine',
    emoji: '🎯',
    section: 'redstone',
    active: false,
  },

  // ── Défi final (custom) ──
  {
    id: 'defi',
    slug: 'defi-master-codeur',
    title: 'Défi Master Codeur',
    subtitle: "Prouve que t'es prêt pour Silica",
    emoji: '🏆',
    section: 'defi',
    active: false,
  },
];

const SECTION_META: Record<Section, { title: string; caption: string }> = {
  prep: {
    title: 'Préparation',
    caption: "Logistique à faire une fois avec papa, avant de commencer",
  },
  cours0: {
    title: 'Cours 0 — Bases in-game',
    caption: 'Bouger, poser, casser, interagir. Sans ça, pas de code.',
  },
  redstone: {
    title: 'Fondations Redstone',
    caption: 'Les 5 modules de programmation du camp Silica, préparés pour toi',
  },
  defi: {
    title: 'Défi final',
    caption: "Quand t'es prêt, tu montres ce que tu sais faire",
  },
};

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

  const sections: Section[] = ['prep', 'cours0', 'redstone', 'defi'];
  const doneCount = Object.values(moduleStatus).filter(Boolean).length;

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
            {doneCount}/{MODULES.length}
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

        {/* Sections */}
        {sections.map(sec => {
          const items = MODULES.filter(m => m.section === sec);
          const meta = SECTION_META[sec];

          return (
            <section key={sec} className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide">
                  {meta.title}
                </h2>
                <p className="text-xs text-white/50 mt-0.5">{meta.caption}</p>
              </div>

              {/* Préparation : carte statique, pas un module */}
              {sec === 'prep' && (
                <div className="rounded-2xl p-4 sm:p-5 flex items-center gap-4 border-2 bg-slate-800/40 border-whi