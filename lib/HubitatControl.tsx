'use client';

// HubitatControl — Composant partagé pour les modules Maison / Chalet.
// Intègre le dashboard Hubitat natif via iframe + ajoute une barre de quick actions
// branded Mission Control au-dessus (sans modifier l'interface Hubitat elle-même).
//
// TODO (Martin) — pour brancher les vrais commandes :
// 1. Active le Maker API dans Hubitat (Apps > Maker API > New App).
// 2. Récupère le endpoint + access_token.
// 3. Remplace MAKER_API_BASE ci-dessous et ajoute les vrais device IDs dans QUICK_ACTIONS.
// En attendant, les boutons "Chauffage ON/OFF/Absence/Soirée" ouvrent une info toast
// et proposent d'aller configurer la scene directement dans Hubitat.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHouse,
  faMountainSun,
  faTemperatureHalf,
  faPowerOff,
  faClock,
  faArrowsRotate,
  faUpRightFromSquare,
  faExpand,
  faCompress,
  faArrowLeft,
  faCircleNotch,
  faFire,
  faSnowflake,
  faMoon,
  faPlane,
  faCircleInfo,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

export type HubitatLocation = 'maison' | 'chalet';

export type HubitatControlProps = {
  location: HubitatLocation;
  /** URL complète du dashboard Hubitat (inclut access_token) */
  dashboardUrl: string;
  /** Titre affiché dans le top bar */
  title: string;
  /** Sous-titre court */
  subtitle: string;
  /** Couleur d'accent — bleu pour maison, ambre pour chalet */
  accentColor: string;
};

type QuickAction = {
  id: string;
  label: string;
  icon: any;
  color: string;
  description: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'heat-on',
    label: 'Chauffage ON',
    icon: faFire,
    color: '#F97316',
    description: 'Active le chauffage (consigne confort).',
  },
  {
    id: 'heat-off',
    label: 'Chauffage OFF',
    icon: faSnowflake,
    color: '#38BDF8',
    description: 'Met le chauffage en veille (consigne hors-gel).',
  },
  {
    id: 'evening',
    label: 'Mode soirée',
    icon: faMoon,
    color: '#A78BFA',
    description: 'Ambiance soirée : chauffage modéré + lumières tamisées.',
  },
  {
    id: 'away',
    label: 'Mode absence',
    icon: faPlane,
    color: '#94A3B8',
    description: 'Absence prolongée : hors-gel + sécurité.',
  },
];

export function HubitatControl({ location, dashboardUrl, title, subtitle, accentColor }: HubitatControlProps) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState<QuickAction | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Garde d'auth basique (le bouton déconnexion est géré par le dashboard principal)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('mc_token');
    if (!token) {
      router.push('/');
      return;
    }
    setAuthReady(true);
  }, [router]);

  const refresh = () => {
    setIframeKey((k) => k + 1);
    setLastRefresh(new Date());
  };

  const locationIcon = location === 'maison' ? faHouse : faMountainSun;

  const refreshLabel = useMemo(() => {
    const d = lastRefresh;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }, [lastRefresh]);

  if (!authReady) {
    return (
      <main className="relative min-h-screen flex items-center justify-center bg-[#0a0a14]">
        <FontAwesomeIcon icon={faCircleNotch} className="text-neon-cyan text-3xl animate-spin" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col bg-[#0a0a14] text-white">
      {/* Top bar — toujours visible sauf en fullscreen */}
      {!fullscreen && (
        <header className="flex items-center justify-between px-3 sm:px-5 py-2 border-b border-white/10 bg-black/40 backdrop-blur z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-white/70 hover:text-white transition flex items-center gap-2 text-sm touch-manipulation"
              aria-label="Retour"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
              <span className="hidden sm:inline">Retour</span>
            </button>
            <div className="h-6 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}50` }}
              >
                <FontAwesomeIcon icon={locationIcon} style={{ color: accentColor }} className="text-sm" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-semibold text-sm sm:text-base truncate">{title}</div>
                <div className="text-white/50 text-[10px] sm:text-xs truncate">{subtitle}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-white/40 text-[11px] hidden md:inline">Sync {refreshLabel}</span>
            <button
              onClick={refresh}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5 text-xs flex items-center gap-1.5 touch-manipulation"
              title="Rafraîchir l'iframe"
            >
              <FontAwesomeIcon icon={faArrowsRotate} className="text-[10px]" />
              <span className="hidden sm:inline">Rafraîchir</span>
            </button>
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5 text-xs flex items-center gap-1.5 touch-manipulation"
              title="Ouvrir dans un nouvel onglet"
            >
              <FontAwesomeIcon icon={faUpRightFromSquare} className="text-[10px]" />
              <span className="hidden sm:inline">Onglet</span>
            </a>
            <button
              onClick={() => setFullscreen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5 text-xs flex items-center gap-1.5 touch-manipulation"
              title="Plein écran"
            >
              <FontAwesomeIcon icon={faExpand} className="text-[10px]" />
              <span className="hidden sm:inline">Plein écran</span>
            </button>
          </div>
        </header>
      )}

      {/* Zone principale : sidebar quick actions + iframe */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Quick actions — top bar en mobile, sidebar en desktop */}
        {!fullscreen && (
          <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-black/20 backdrop-blur-sm p-3 sm:p-4 overflow-x-auto lg:overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 hidden lg:block">Scènes rapides</p>
            <div className="flex lg:flex-col gap-2">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setToast(a)}
                  className="group flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] transition touch-manipulation min-w-[140px] lg:min-w-0"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${a.color}18`, border: `1px solid ${a.color}40` }}
                  >
                    <FontAwesomeIcon icon={a.icon} style={{ color: a.color }} />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-xs sm:text-sm font-medium">{a.label}</div>
                    <div className="text-[10px] text-white/45 hidden lg:block line-clamp-2">{a.description}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[10px] sm:text-[11px] text-amber-200/80 leading-relaxed hidden lg:block">
              <FontAwesomeIcon icon={faCircleInfo} className="mr-1.5" />
              Scènes à configurer — active le Maker API dans Hubitat puis colle les endpoints dans <code>HubitatControl.tsx</code>.
            </div>
          </aside>
        )}

        {/* Iframe Hubitat */}
        <div className="relative flex-1 bg-black">
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={dashboardUrl}
            title={`Dashboard Hubitat ${title}`}
            className="w-full h-full min-h-[60vh] border-0"
            style={{ height: fullscreen ? '100vh' : 'calc(100vh - 56px)' }}
            allow="fullscreen"
          />
          {fullscreen && (
            <button
              onClick={() => setFullscreen(false)}
              className="absolute top-3 right-3 z-[200] px-3 py-2 rounded-lg bg-black/80 border border-white/20 hover:bg-black text-xs flex items-center gap-2 backdrop-blur touch-manipulation"
            >
              <FontAwesomeIcon icon={faCompress} />
              Quitter plein écran
            </button>
          )}
        </div>
      </div>

      {/* Toast info quand on clique une scène (stub en attendant Maker API) */}
      {toast && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-up">
          <div className="glass w-full max-w-md rounded-2xl p-5 sm:p-6 border border-white/10">
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${toast.color}20`, border: `1px solid ${toast.color}50` }}
              >
                <FontAwesomeIcon icon={toast.icon} style={{ color: toast.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider text-white/40">Scène</div>
                <div className="font-display font-semibold text-lg leading-tight">{toast.label}</div>
              </div>
              <button
                onClick={() => setToast(null)}
                className="text-white/50 hover:text-white/90 touch-manipulation"
                aria-label="Fermer"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <p className="text-sm text-white/70 mb-4">{toast.description}</p>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 mb-4 text-[11px] sm:text-xs text-amber-200/90 leading-relaxed">
              <FontAwesomeIcon icon={faCircleInfo} className="mr-1.5" />
              Cette scène n'est pas encore branchée. Pour l'activer, configure le Maker API Hubitat et donne-moi l'endpoint — je la câble à ce bouton.
            </div>
            <div className="flex gap-2">
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 hover:bg-white/10 text-sm text-center touch-manipulation"
              >
                <FontAwesomeIcon icon={faUpRightFromSquare} className="mr-2 text-xs" />
                Ouvrir Hubitat
              </a>
              <button
                onClick={() => setToast(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-neon-cyan/20 border border-neon-cyan/40 hover:bg-neon-cyan/30 text-sm touch-manipulation"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
