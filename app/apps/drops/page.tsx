'use client';

// /apps/drops/?slug=xxx — wrapper Next.js qui iframe le HTML d'un drop.
//
// JALON 1 du bus drop <-> host (postMessage) :
// - Le backend injecte automatiquement le SDK `window.MissionControl.*` dans tout drop servi
//   (cf. backend/src/routes/heimdall.js getDropContent). Aucun drop n'a a se cabler.
// - Ce wrapper ecoute les events du drop (awardXp, markComplete, saveState, openCompanion,
//   playSound, toast, setProgress, exit) et maintient un HUD : XP session, progress bar,
//   bouton companion, confetti completion.
// - Le wrapper repond aussi aux requetes du drop (loadState resolu via localStorage, profile
//   kid envoye sur 'ready').
// - Storage J1 : localStorage cote client. J2 (futur) : modele DropProgress en DB.
//
// PALETTE (2026-05-25, drop violet/pink) : arcade lime + cyan + amber + emerald.
// Cf. memory/feedback_palette_no_purple.md.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faRotateRight,
  faBolt,
  faCircleQuestion,
  faXmark,
  faTrophy,
  faVolumeXmark,
  faVolumeHigh,
  faRobot,
} from '@fortawesome/free-solid-svg-icons';
import { getStoredUser } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

type ToastItem = { id: number; text: string; kind: 'info' | 'win' | 'warn' };

function DropWrapperInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = (searchParams?.get('slug') || '').trim();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ title: string; iconEmoji: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // HUD state
  const [sessionXp, setSessionXp] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showCompanion, setShowCompanion] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [xpBurst, setXpBurst] = useState<{ id: number; amount: number; reason: string | null } | null>(null);
  const xpBurstTimer = useRef<number | null>(null);

  // ----- bootstrap -----
  useEffect(() => {
    const u = getStoredUser();
    if (!u) { router.push('/'); return; }
    setUser(u);
    if (!slug) { setError("slug manquant dans l'URL."); return; }
    (async () => {
      try {
        const token = localStorage.getItem('mc_token');
        const res = await fetch(`${API_URL}/heimdall/me/drops`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const drop = (data.drops || []).find((d: any) => d.slug === slug);
        if (!drop) { setError("Pas d'accès à ce drop ou drop introuvable."); return; }
        setMeta({ title: drop.title, iconEmoji: drop.iconEmoji || '📦' });
      } catch (e: any) {
        setError(e?.message || 'Erreur chargement métadonnées');
      }
    })();
  }, [slug, router]);

  // restaure completion locale + mute pref
  useEffect(() => {
    if (!user || !slug) return;
    try {
      setCompleted(localStorage.getItem(`mc_drop_completed_${slug}_${user.id}`) === '1');
      setMuted(localStorage.getItem('mc_drop_muted') === '1');
    } catch {/* ignore */}
  }, [user, slug]);

  // ----- audio mini-lib (Web Audio, zero asset) -----
  const playSound = useCallback((name: string) => {
    if (muted) return;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const presets: Record<string, { freqs: number[]; dur: number; type?: OscillatorType; gain?: number }> = {
        win:   { freqs: [523, 659, 784, 1046], dur: 0.22, type: 'triangle', gain: 0.18 },
        ding:  { freqs: [880, 1318], dur: 0.16, type: 'sine', gain: 0.16 },
        click: { freqs: [1200], dur: 0.04, type: 'square', gain: 0.10 },
        fail:  { freqs: [196, 165], dur: 0.28, type: 'sawtooth', gain: 0.14 },
        bell:  { freqs: [1568, 2093], dur: 0.6, type: 'sine', gain: 0.12 },
        combo: { freqs: [659, 880, 1175, 1568], dur: 0.14, type: 'square', gain: 0.13 },
      };
      const p = presets[name] || presets.click;
      p.freqs.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = p.type || 'sine';
        o.frequency.value = freq;
        const start = now + i * (p.dur * 0.55);
        const stop = start + p.dur;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(p.gain || 0.15, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, stop);
        o.connect(g); g.connect(ctx.destination);
        o.start(start); o.stop(stop + 0.02);
      });
    } catch {/* ignore */}
  }, [muted]);

  // ----- toasts -----
  const pushToast = useCallback((text: string, kind: ToastItem['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, kind }].slice(-4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // ----- XP burst overlay -----
  const flashXp = useCallback((amount: number, reason: string | null) => {
    if (xpBurstTimer.current) window.clearTimeout(xpBurstTimer.current);
    setXpBurst({ id: Date.now(), amount, reason });
    xpBurstTimer.current = window.setTimeout(() => setXpBurst(null), 1400);
  }, []);

  // ----- envoi vers le drop -----
  const postToDrop = useCallback((mc: string, extra: Record<string, any> = {}) => {
    try {
      iframeRef.current?.contentWindow?.postMessage({ mc, ...extra }, '*');
    } catch {/* ignore */}
  }, []);

  // ----- proxy fetch authenticated pour les scores -----
  const proxyFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const tok = typeof window !== 'undefined' ? localStorage.getItem('mc_token') : null;
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      return { ok: false, status: res.status, error: (json && json.erreur) || `HTTP ${res.status}` };
    }
    return json && typeof json === 'object' ? json : { ok: true };
  }, []);

  // ----- ecoute des messages du drop -----
  useEffect(() => {
    if (!user || !slug) return;
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return;
      const d = e.data as any;
      const mc = d.mc;
      if (typeof mc !== 'string' || !mc) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;

      switch (mc) {
        case 'ready': {
          postToDrop('profile', {
            kid: {
              id: user.id,
              firstName: user.firstName || user.username || '',
              profile: user.profile || null,
              role: user.role || null,
            },
            slug,
          });
          break;
        }
        case 'awardXp': {
          const amt = Math.max(0, Math.min(9999, Number(d.amount) | 0));
          if (amt > 0) {
            setSessionXp((x) => x + amt);
            flashXp(amt, d.reason || null);
            playSound('ding');
            try {
              const key = `mc_drop_xp_${user.id}`;
              const cur = parseInt(localStorage.getItem(key) || '0', 10) || 0;
              localStorage.setItem(key, String(cur + amt));
            } catch {/* ignore */}
          }
          break;
        }
        case 'setProgress': {
          const p = Math.max(0, Math.min(100, Number(d.percent) | 0));
          setProgress(p);
          break;
        }
        case 'markComplete': {
          setCompleted(true);
          setProgress(100);
          playSound('win');
          pushToast('Drop complété ! 🎉', 'win');
          try {
            localStorage.setItem(`mc_drop_completed_${slug}_${user.id}`, '1');
          } catch {/* ignore */}
          break;
        }
        case 'saveState': {
          try {
            localStorage.setItem(
              `mc_drop_state_${slug}_${user.id}`,
              JSON.stringify(d.state ?? null),
            );
          } catch {/* ignore */}
          break;
        }
        case 'loadState': {
          let state: any = null;
          try {
            const raw = localStorage.getItem(`mc_drop_state_${slug}_${user.id}`);
            state = raw ? JSON.parse(raw) : null;
          } catch { state = null; }
          postToDrop('state', { state, requestId: d.requestId });
          break;
        }
        case 'openCompanion': {
          setShowCompanion(true);
          if (d.message) pushToast(`Companion : « ${String(d.message).slice(0, 60)} »`, 'info');
          break;
        }
        case 'playSound': {
          playSound(String(d.name || 'click'));
          break;
        }
        case 'toast': {
          const kind = ['info', 'win', 'warn'].includes(d.kind) ? d.kind : 'info';
          pushToast(String(d.text || '').slice(0, 140), kind);
          break;
        }
        case 'exit': {
          router.back();
          break;
        }
        case 'submitScore': {
          const reqId = d.requestId;
          const payload = (d.payload && typeof d.payload === 'object') ? d.payload : {};
          (async () => {
            const result = await proxyFetch('/heimdall/drops/scores', {
              method: 'POST',
              body: JSON.stringify({ ...payload, slug }),
            });
            postToDrop('submitScore-result', { requestId: reqId, result });
          })();
          break;
        }
        case 'getMyBest': {
          const reqId = d.requestId;
          const q = d.mode ? `?mode=${encodeURIComponent(d.mode)}` : '';
          (async () => {
            const result = await proxyFetch(`/heimdall/drops/${encodeURIComponent(slug)}/scores/me${q}`);
            postToDrop('getMyBest-result', { requestId: reqId, result });
          })();
          break;
        }
        case 'getLeaderboard': {
          const reqId = d.requestId;
          const params: string[] = [];
          if (d.mode) params.push(`mode=${encodeURIComponent(d.mode)}`);
          if (d.limit) params.push(`limit=${encodeURIComponent(d.limit)}`);
          const qs = params.length ? `?${params.join('&')}` : '';
          (async () => {
            const result = await proxyFetch(`/heimdall/drops/${encodeURIComponent(slug)}/scores/leaderboard${qs}`);
            postToDrop('getLeaderboard-result', { requestId: reqId, result });
          })();
          break;
        }
        default: /* ignore unknown */ break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [user, slug, postToDrop, flashXp, playSound, pushToast, router, proxyFetch]);

  useEffect(() => {
    if (!showCompanion) postToDrop('resume');
  }, [showCompanion, postToDrop]);

  const toggleMute = () => {
    setMuted((m) => {
      const nv = !m;
      try { localStorage.setItem('mc_drop_muted', nv ? '1' : '0'); } catch {/* ignore */}
      return nv;
    });
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('mc_token') : null;
  const contentUrl = slug
    ? `${API_URL}/heimdall/drops/${encodeURIComponent(slug)}/content${token ? `?token=${encodeURIComponent(token)}` : ''}`
    : '';

  const companionUrl = useMemo(() => '/apps/friday/', []);

  // Progress en segments arcade (10 chunks)
  const segments = useMemo(() => {
    const filled = Math.round(progress / 10);
    return Array.from({ length: 10 }, (_, i) => i < filled);
  }, [progress]);

  if (error) {
    return (
      <main className="min-h-[100dvh] bg-cosmos-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-rose-300 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-xl border border-white/20 text-white hover:bg-white/5"
          >
            Retour
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-cosmos-950 z-0" style={{ height: '100dvh' }}>
      {/* HEADER */}
      <header
        className="relative flex items-center gap-2 px-3 pb-2 border-b border-lime-400/15 bg-cosmos-950/85 backdrop-blur-md flex-shrink-0"
        style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Retour"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-sm" />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xl">{meta?.iconEmoji || '📦'}</span>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.25em] text-lime-300/70 leading-tight font-mono">
              DROP {completed && <span className="text-emerald-300">· COMPLÉTÉ</span>}
            </p>
            <p className="font-semibold text-sm text-white truncate leading-tight">{meta?.title || slug}</p>
          </div>
        </div>

        {/* XP session — LCD style */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-lg border border-amber-400/40 bg-amber-400/5 text-amber-200 text-sm font-mono tabular-nums"
          title="XP gagné cette session"
          style={{ boxShadow: '0 0 18px -8px rgba(245, 158, 11, 0.55) inset' }}
        >
          <FontAwesomeIcon icon={faBolt} className="text-amber-300 text-xs" />
          <span className="font-bold tracking-wider">{String(sessionXp).padStart(4, '0')}</span>
          <span className="text-amber-300/50 text-[10px] tracking-[0.2em]">XP</span>
        </div>

        {/* Companion (lime) */}
        <button
          onClick={() => setShowCompanion(true)}
          className="relative w-10 h-10 rounded-xl border border-lime-400/50 bg-lime-400/10 text-lime-200 hover:bg-lime-400/20 transition flex items-center justify-center flex-shrink-0"
          aria-label="Demander de l'aide"
          title="Demander de l'aide"
        >
          <FontAwesomeIcon icon={faCircleQuestion} className="text-base" />
        </button>

        {/* Mute */}
        <button
          onClick={toggleMute}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label={muted ? 'Activer son' : 'Couper son'}
        >
          <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} className="text-sm" />
        </button>

        {/* Refresh */}
        <button
          onClick={() => {
            if (iframeRef.current) {
              setLoading(true);
              setSessionXp(0);
              setProgress(0);
              iframeRef.current.src = iframeRef.current.src;
            }
          }}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Rafraîchir"
        >
          <FontAwesomeIcon icon={faRotateRight} className="text-sm" />
        </button>
      </header>

      {/* Progress bar segmente (arcade) */}
      <div className="h-2 bg-black/40 flex items-center gap-[2px] px-[2px] flex-shrink-0">
        {segments.map((on, i) => (
          <div
            key={i}
            className="flex-1 h-full rounded-[2px] transition-colors duration-300"
            style={{
              background: on
                ? `linear-gradient(180deg, #a3e635 0%, #65a30d 100%)`
                : 'rgba(255,255,255,0.04)',
              boxShadow: on ? '0 0 6px rgba(163, 230, 53, 0.45)' : 'none',
            }}
          />
        ))}
      </div>

      {/* IFRAME */}
      <div className="relative flex-1 w-full">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-cosmos-950 z-10 pointer-events-none">
            <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={contentUrl}
          className="absolute inset-0 w-full h-full border-0 bg-cosmos-950"
          title={meta?.title || slug}
          allow="clipboard-read; clipboard-write; fullscreen; autoplay"
          onLoad={() => setLoading(false)}
        />

        {/* XP burst — style tampon arcade */}
        {xpBurst && (
          <div
            key={xpBurst.id}
            className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 z-20 select-none"
            style={{ animation: 'xpburst 1.3s cubic-bezier(.16,1,.3,1) forwards' }}
          >
            <div
              className="px-5 py-2.5 rounded-2xl text-cosmos-950 font-display font-extrabold text-2xl shadow-2xl flex items-center gap-2"
              style={{
                background: 'linear-gradient(90deg, #a3e635, #fbbf24)',
                boxShadow: '0 12px 40px -10px rgba(163, 230, 53, 0.6), 0 0 0 3px rgba(10,10,20,0.6) inset',
              }}
            >
              <FontAwesomeIcon icon={faBolt} /> +{xpBurst.amount} XP
            </div>
            {xpBurst.reason && (
              <p className="text-center text-lime-200 text-xs mt-1.5 font-mono">{xpBurst.reason}</p>
            )}
          </div>
        )}

        {/* Completion badge */}
        {completed && progress === 100 && (
          <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center z-20">
            <div className="px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-mono flex items-center gap-2 backdrop-blur-md tracking-wider">
              <FontAwesomeIcon icon={faTrophy} /> MISSION COMPLÉTÉE
            </div>
          </div>
        )}
      </div>

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-30 flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'px-3.5 py-2 rounded-xl text-sm shadow-lg backdrop-blur-md border max-w-[80vw] sm:max-w-sm font-mono',
              t.kind === 'win' && 'bg-emerald-500/25 border-emerald-400/50 text-emerald-100',
              t.kind === 'warn' && 'bg-amber-500/25 border-amber-400/50 text-amber-100',
              t.kind === 'info' && 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100',
            ].filter(Boolean).join(' ')}
            style={{ animation: 'toastIn 0.3s ease-out' }}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* Companion overlay (lime accent) */}
      {showCompanion && (
        <div className="fixed inset-0 z-40 flex flex-col bg-cosmos-950/95 backdrop-blur-md" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <header className="flex items-center gap-2 px-3 py-2 border-b border-lime-400/40 bg-cosmos-950/90 flex-shrink-0">
            <div className="flex-1 flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-lime-400/15 border border-lime-400/40 flex items-center justify-center">
                <FontAwesomeIcon icon={faRobot} className="text-lime-300 text-sm" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-[0.25em] text-lime-300/70 leading-tight font-mono">COMPANION</p>
                <p className="font-semibold text-sm text-white leading-tight">FRIDAY</p>
              </div>
            </div>
            <button
              onClick={() => setShowCompanion(false)}
              className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center"
              aria-label="Fermer"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </header>
          <iframe
            src={companionUrl}
            className="flex-1 w-full border-0 bg-cosmos-950"
            title="FRIDAY companion"
          />
        </div>
      )}

      {/* Keyframes */}
      <style jsx>{`
        @keyframes xpburst {
          0%   { transform: translate(-50%, 10px) scale(0.5) rotate(-6deg); opacity: 0; }
          18%  { transform: translate(-50%, 0)    scale(1.15) rotate(-2deg); opacity: 1; }
          40%  { transform: translate(-50%, 0)    scale(1.0) rotate(1deg); opacity: 1; }
          80%  { transform: translate(-50%, -10px) scale(1.0) rotate(0); opacity: 1; }
          100% { transform: translate(-50%, -42px) scale(0.92) rotate(0); opacity: 0; }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </main>
  );
}

export default function DropPage() {
  return (
    <Suspense
      fallback={
        <main className="fixed inset-0 flex items-center justify-center bg-cosmos-950 z-0" style={{ height: '100dvh' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </main>
      }
    >
      <DropWrapperInner />
    </Suspense>
  );
}
