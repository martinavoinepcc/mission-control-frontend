'use client';

import { useEffect, useState } from 'react';
import {
  detectPushEnv,
  subscribeToPush,
  getPushStatus,
} from '@/lib/push-api';

const DISMISS_KEY = 'mc_push_banner_dismissed_v1';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 jours

type State = 'idle' | 'working' | 'ok' | 'error' | 'needs_ios_install';

/**
 * Bannière proactive qui apparaît automatiquement sur le dashboard + la messagerie
 * quand l'user n'a pas encore activé les push. Se dismiss pour 7 jours.
 *
 * Respecte les contraintes plateforme :
 *   - iOS : ne propose le bouton "Activer" que si la PWA est installée (standalone).
 *           Sinon pointe vers le guide dans /profil.
 *   - Desktop/Android : bouton direct "Activer" qui déclenche Notification.requestPermission().
 */
export default function PushBanner() {
  const [visible, setVisible] = useState(false);
  const [needsIosInstall, setNeedsIosInstall] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function check() {
    const env = detectPushEnv();
    if (typeof window === 'undefined') return;
    if (!env.supported) { setVisible(false); return; }

    // Déjà subscribé côté serveur ? On sort.
    const status = await getPushStatus();
    if (status && status.count > 0 && env.permission === 'granted') {
      setVisible(false);
      return;
    }

    if (env.permission === 'denied') {
      // L'user a explicitement refusé. On ne spamme pas.
      setVisible(false);
      return;
    }

    // Dismiss rescent ?
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          setVisible(false);
          return;
        }
      }
    } catch {}

    // Sur iOS non standalone : on propose d'abord d'installer
    if (env.ios && !env.standalone) {
      setNeedsIosInstall(true);
      setVisible(true);
      return;
    }

    setNeedsIosInstall(false);
    setVisible(true);
  }

  useEffect(() => {
    check();
    // Recheck quand l'onglet revient au focus (perm peut avoir changé)
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (!visible) return null;

  async function onActivate() {
    setState('working');
    setMessage('');
    const r = await subscribeToPush();
    if (r.ok) {
      setState('ok');
      setMessage('Notifications activées sur ce device.');
      setTimeout(() => setVisible(false), 1600);
    } else {
      setState('error');
      setMessage(r.reason || 'Erreur');
    }
  }

  function onDismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setVisible(false);
  }

  return (
    <div className="mb-4 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/12 via-slate-900/40 to-slate-950 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-sky-500/20 text-xl">
          🔔
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {needsIosInstall
              ? 'Installe Mission Control sur ton iPhone'
              : 'Active les notifications pour ne rien rater'}
          </p>
          <p className="mt-0.5 text-xs text-slate-300">
            {needsIosInstall
              ? 'Apple demande que la PWA soit sur ton écran d\'accueil avant d\'autoriser les push.'
              : 'Un push arrive directement sur ton appareil à chaque message, même app fermée.'}
          </p>
          {message && (
            <p className={`mt-2 text-xs ${state === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
              {message}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {needsIosInstall ? (
              <a
                href="/profil"
                className="inline-flex items-center rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400"
              >
                Voir le guide d&apos;installation →
              </a>
            ) : (
              <button
                onClick={onActivate}
                disabled={state === 'working'}
                className="inline-flex items-center rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60"
              >
                {state === 'working' ? 'Activation…' : 'Activer les notifications'}
              </button>
            )}
            <button
              onClick={onDismiss}
              className="inline-flex items-center rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-700"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
