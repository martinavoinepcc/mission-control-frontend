'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEye, faArrowLeft, faComments, faFlask, faChartLine, faPlug,
  faCircleNotch,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { getMe, clearToken, type User } from '@/lib/api';
import { listFridayConversations, type BridgeStatus } from '@/lib/friday-api';

type ModuleStatus = 'live' | 'soon';

type ModuleCard = {
  slug: string;
  name: string;
  tagline: string;
  icon: IconDefinition;
  status: ModuleStatus;
  href?: string;
  external?: boolean;
  // Pour FRIDAY : statut live de la boucle de poll
  liveBadge?: 'connected' | 'idle' | 'off' | null;
};

export default function HeimdallHub() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bridge, setBridge] = useState<BridgeStatus | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setUser(me.user);
        // Status FRIDAY (bridge) — si admin, fetch ; sinon ignore
        if (me.user.role === 'ADMIN') {
          try {
            const data = await listFridayConversations();
            setBridge(data.bridge);
          } catch { /* silencieux */ }
        }
      } catch {
        clearToken();
        router.push('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="relative flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="absolute inset-0 cosmic-grid" />
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </main>
    );
  }

  if (!user) return null;

  // Définition des modules HEIMDALL
  const fridayBadge: 'connected' | 'idle' | 'off' | null = !bridge?.configured
    ? 'off'
    : bridge.active
    ? 'connected'
    : 'idle';

  const HEIMDALL_COCKPIT_URL = process.env.NEXT_PUBLIC_HEIMDALL_COCKPIT_URL || 'https://mission-control-heimdall.onrender.com';

  const modules: ModuleCard[] = [
    {
      slug: 'cockpit',
      name: 'Cockpit complet',
      tagline: 'UI Aion UI complète — agents, tâches, cron, logs, skills, secrets, approvals.',
      icon: faEye,
      status: 'live',
      href: '/apps/heimdall/cockpit/',
      external: false,
    },
    {
      slug: 'friday-chat',
      name: 'FRIDAY (chat rapide)',
      tagline: 'Chat minimaliste avec ton agent Hermes — pour les questions rapides.',
      icon: faComments,
      status: 'live',
      href: '/apps/friday/',
      liveBadge: fridayBadge,
    },
    {
      slug: 'lab',
      name: 'Lab',
      tagline: 'Espace créatif autonome — sandbox sur sous-domaine isolé.',
      icon: faFlask,
      status: 'soon',
    },
    {
      slug: 'monitoring',
      name: 'Monitoring',
      tagline: 'Dashboards systèmes, métriques, état des intégrations.',
      icon: faChartLine,
      status: 'soon',
    },
  ];

  return (
    <main className="relative" style={{ minHeight: '100dvh' }}>
      <div className="absolute inset-0 cosmic-grid pointer-events-none" />
      <div className="blob bg-neon-violet w-[480px] h-[480px] -top-32 -left-24 animate-pulse-slow opacity-40" />
      <div className="blob bg-neon-cyan w-[400px] h-[400px] -bottom-32 -right-24 animate-pulse-slow opacity-30" style={{ animationDelay: '2s' }} />

      <div
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-10"
        style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-2 mb-6 sm:mb-10 animate-fade-up">
          <button
            onClick={() => router.push('/dashboard?realm=family')}
            className="w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center sm:gap-2"
            aria-label="Retour à Famille"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-sm sm:text-xs" />
            <span className="hidden sm:inline">Famille</span>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#29D0FE20', border: '1px solid #29D0FE40' }}
            >
              <FontAwesomeIcon icon={faEye} className="text-cyan-300" />
            </div>
            <span className="font-display font-semibold text-base sm:text-lg truncate">HEIMDALL</span>
          </div>
        </header>

        {/* Hero */}
        <section className="mb-6 sm:mb-10 animate-fade-up">
          <p className="text-white/40 text-xs tracking-[0.25em] uppercase mb-3">Layer global</p>
          <h1 className="text-2xl sm:text-5xl font-bold font-display leading-tight">
            <span className="bg-gradient-to-r from-neon-violet to-neon-cyan bg-clip-text text-transparent">
              HEIMDALL
            </span>
          </h1>
          <p className="text-white/60 mt-3 max-w-2xl text-sm sm:text-base">
            <span className="font-semibold text-white/80">H</span>olistic{' '}
            <span className="font-semibold text-white/80">E</span>nvironmental{' '}
            <span className="font-semibold text-white/80">I</span>ntelligence &amp;{' '}
            <span className="font-semibold text-white/80">M</span>onitoring,{' '}
            <span className="font-semibold text-white/80">D</span>ecision{' '}
            <span className="font-semibold text-white/80">A</span>nd{' '}
            <span className="font-semibold text-white/80">L</span>ink{' '}
            <span className="font-semibold text-white/80">L</span>ayer.
          </p>
          <p className="text-white/50 mt-2 text-sm sm:text-base">
            Voit tout. Connecte tout. Le hub d&apos;orchestration de tes intelligences et projets.
          </p>
        </section>

        {/* Modules grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
          {modules.map((m, idx) => (
            <ModuleCardView key={m.slug} module={m} delay={idx * 80} router={router} />
          ))}
        </section>

        {/* Footer note */}
        <p className="mt-10 text-center text-[11px] text-white/30">
          Modules supplémentaires arrivent — chaque sous-projet aura son propre sous-domaine isolé.
        </p>
      </div>
    </main>
  );
}

function ModuleCardView({
  module,
  delay,
  router,
}: {
  module: ModuleCard;
  delay: number;
  router: ReturnType<typeof useRouter>;
}) {
  const isLive = module.status === 'live';
  const onClick = () => {
    if (!isLive) return;
    if (module.href) {
      if (module.external) window.open(module.href, '_blank', 'noopener,noreferrer');
      else router.push(module.href);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isLive}
      className={`group relative text-left rounded-2xl overflow-hidden glass p-4 sm:p-6 transition-all animate-fade-up ${
        isLive ? 'hover:scale-[1.02] hover:shadow-2xl cursor-pointer' : 'opacity-50 cursor-not-allowed'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="absolute inset-0 opacity-15 transition-opacity group-hover:opacity-30"
        style={{ background: 'radial-gradient(circle at 30% 20%, #29D0FE, transparent 70%)' }}
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div
            className="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex-shrink-0 transition-transform group-hover:scale-110"
            style={{ background: '#29D0FE20', border: '1px solid #29D0FE40' }}
          >
            <FontAwesomeIcon icon={module.icon} className="text-lg sm:text-xl text-cyan-300" />
          </div>
          {module.liveBadge && (
            <BridgeBadge state={module.liveBadge} />
          )}
          {!isLive && (
            <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 flex-shrink-0">
              Bientôt
            </span>
          )}
        </div>
        <div>
          <h3 className="font-display text-base sm:text-xl font-semibold mb-0.5 sm:mb-1">{module.name}</h3>
          <p className="text-white/50 text-xs sm:text-sm">{module.tagline}</p>
        </div>
      </div>
    </button>
  );
}

function BridgeBadge({ state }: { state: 'connected' | 'idle' | 'off' }) {
  if (state === 'connected') {
    return (
      <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex-shrink-0 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Connectée
      </span>
    );
  }
  if (state === 'idle') {
    return (
      <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 flex-shrink-0 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        En attente
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 flex-shrink-0 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
      Hors ligne
    </span>
  );
}
