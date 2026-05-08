'use client';

// Hub Éducatif v4 — Kaz & Moi only (MCreator Academy retirée du hub ;
// routes /mcreator/* conservées mais non linkées, on les archivera plus tard).
// On additionnera d'autres niveaux / modules Kaz au fur et à mesure.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  getEduMe,
  clearToken,
  type EduMeStats,
} from '@/lib/api';
import { UI } from '@/lib/icons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

type DropCard = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  iconEmoji: string | null;
  realm: string;
};

export default function EducatifHubPage() {
  const router = useRouter();
  const [stats, setStats] = useState<EduMeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drops, setDrops] = useState<DropCard[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const s = await getEduMe();
        setStats(s);
      } catch (err: any) {
        if (err.message.includes('Session') || err.message.includes('Authentification')) {
          clearToken();
          router.push('/');
          return;
        }
        setError(err.message || 'Erreur lors du chargement.');
      } finally {
        setLoading(false);
      }
    })();
    // Fetch drops accessibles a l'user (silencieux : si erreur, juste pas de section)
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('mc_token') : null;
        if (!token) return;
        const res = await fetch(`${API_URL}/heimdall/me/drops`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setDrops((data.drops || []).filter((d: DropCard) => d.realm === 'EDUCATIF' || d.realm === 'FAMILY'));
      } catch { /* silent */ }
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 cosmic-grid" />
        <FontAwesomeIcon icon={UI.spinner} className="text-neon-cyan text-3xl animate-spin" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <div className="absolute inset-0 cosmic-grid" />
      <div className="blob bg-violet-500 w-[420px] h-[420px] -top-48 -right-40 animate-pulse-slow opacity-[0.10]" />
      <div className="blob bg-pink-400 w-[340px] h-[340px] -bottom-32 -left-32 animate-pulse-slow opacity-[0.08]" style={{ animationDelay: '2.5s' }} />

      <div
        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-6 sm:pb-10"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <header className="flex items-center justify-between mb-8">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
            <FontAwesomeIcon icon={UI.back} /> Retour
          </button>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <FontAwesomeIcon icon={UI.graduationCap} className="text-emerald-400" />
            <span className="font-display">Éducatif</span>
          </div>
        </header>

        {error && (
          <div className="glass rounded-xl p-4 mb-6 text-sm text-red-300 border border-red-500/30">
            <FontAwesomeIcon icon={UI.warning} className="mr-2" />
            {error}
          </div>
        )}

        {stats && (
          <section className="glass rounded-2xl p-6 mb-8 border border-emerald-500/20 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/40 mb-1">Rang actuel</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                    <FontAwesomeIcon icon={UI.crown} className="text-white text-lg" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold text-emerald-300">{stats.rank.label}</h2>
                    <p className="text-white/50 text-sm">{stats.totalXp} XP · {stats.completedCount} missions complétées</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Stat icon={UI.star} value={stats.totalStars} label="étoiles" color="#FBBF24" />
                <Stat icon={UI.bolt} value={stats.totalXp} label="XP" color="#06B6D4" />
                <Stat icon={UI.medal} value={stats.badges.length} label="badges" color="#A855F7" />
              </div>
            </div>
          </section>
        )}

        {/* HERO KAZ & MOI — module actif principal */}
        <section className="mb-6">
          <h2 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-3 font-mono">Pour Jackson</h2>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
            <span className="grad-text">Kaz</span> &amp; Moi
          </h1>
          <p className="text-white/50 mb-6">Kaz streame, tu codes. Ton code change la game en direct — pas de théorie qui endort.</p>

          <button
            onClick={() => router.push('/apps/educatif/kaz')}
            className="group relative w-full text-left rounded-2xl overflow-hidden glass p-6 sm:p-8 border border-violet-500/30 hover:border-violet-400/60 transition-all hover:scale-[1.005] animate-fade-up"
          >
            <div
              className="absolute inset-0 opacity-20 group-hover:opacity-30 transition"
              style={{ background: 'radial-gradient(circle at 25% 20%, #8b5cf6, transparent 70%)' }}
            />
            <div className="relative flex items-center gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-3xl sm:text-4xl shadow-lg shadow-violet-500/30 flex-shrink-0">
                🎮
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-violet-300/80 mb-1 font-mono">
                  Kaz · streamer Twitch · coaching live
                </p>
                <h3 className="font-display text-xl sm:text-2xl font-bold mb-1">Yo JaX. On code pendant qu'on joue.</h3>
                <p className="text-white/60 text-sm">
                  Mod Survie XP, arène, variables qui impactent le combat en temps réel. Niveau 1 déblocké · S2-S4 à venir.
                </p>
              </div>
              <div className="hidden sm:flex items-center text-violet-300 font-mono text-sm">▶ START</div>
            </div>
          </button>
        </section>

        {/* IMPRO ENGINE — pour Alizée */}
        <section className="mb-6">
          <h2 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-3 font-mono">Pour Alizée</h2>
          <button
            onClick={() => router.push('/apps/educatif/impro')}
            className="group relative w-full text-left rounded-2xl overflow-hidden glass p-6 sm:p-8 border border-rose-500/30 hover:border-rose-400/60 transition-all hover:scale-[1.005] animate-fade-up"
          >
            <div
              className="absolute inset-0 opacity-20 group-hover:opacity-30 transition"
              style={{ background: 'linear-gradient(120deg, rgba(220,38,38,0.35), rgba(59,130,246,0.35))' }}
            />
            <div className="relative flex items-center gap-5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-rose-500 to-blue-500 flex items-center justify-center text-3xl sm:text-4xl shadow-lg shadow-rose-500/30 flex-shrink-0">
                🎭
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-rose-300/80 mb-1 font-mono">
                  Impro Engine · LNI Québec · pratique + match
                </p>
                <h3 className="font-display text-xl sm:text-2xl font-bold mb-1">Allez, on joue une impro.</h3>
                <p className="text-white/60 text-sm">
                  Mode Pratique (carte aléatoire, timer, cloche) + Mode Match (2 équipes, rounds, score). 25 catégories, 60 thèmes.
                </p>
              </div>
              <div className="hidden sm:flex items-center text-rose-300 font-mono text-sm">▶ ENTER</div>
            </div>
          </button>
        </section>

        {/* DROPS FRIDAY — modules pousses par FRIDAY (visible si l'user a des accès) */}
        {drops.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-3 font-mono">📦 Modules de FRIDAY</h2>
            <p className="text-white/50 text-sm mb-4">Outils sur mesure créés pour toi.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {drops.map((d) => (
                <button
                  key={d.id}
                  onClick={() => router.push(`/apps/drops?slug=${encodeURIComponent(d.slug)}`)}
                  className="group relative text-left rounded-xl overflow-hidden glass p-5 border border-cyan-500/30 hover:border-cyan-400/60 transition-all hover:scale-[1.005] animate-fade-up"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20 flex-shrink-0">
                      {d.iconEmoji || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold mb-0.5 truncate">{d.title}</h3>
                      {d.description && <p className="text-white/55 text-xs line-clamp-2">{d.description}</p>}
                    </div>
                    <div className="text-cyan-300 font-mono text-xs">▶</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <FontAwesomeIcon icon={icon} style={{ color }} className="text-lg mb-0.5" />
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  );
}
