'use client';

import { useEffect, useState } from 'react';
import {
  detectPushEnv,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  getPushStatus,
} from '@/lib/push-api';

type Status = 'idle' | 'working' | 'ok' | 'error';

/**
 * Bloc interactif pour activer/désactiver les notifications et envoyer un test.
 * Destiné à la page /profil. Gère les cas iOS (hors standalone) via message clair.
 */
export default function PushPermissionPrompt() {
  const [env, setEnv] = useState<ReturnType<typeof detectPushEnv> | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');

  const refresh = async () => {
    setEnv(detectPushEnv());
    const s = await getPushStatus();
    if (s) setCount(s.count);
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!env) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-400">
        Chargement de la configuration des notifications…
      </div>
    );
  }

  if (!env.supported) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-300">
        <p className="font-semibold text-slate-100">
          Ce navigateur ne supporte pas les notifications Web
        </p>
        <p className="mt-2 text-slate-400">
          Essaie Chrome, Firefox ou Edge. Sur iPhone, utilise Safari avec l&apos;app installée à
          l&apos;écran d&apos;accueil.
        </p>
      </div>
    );
  }

  if (env.ios && !env.standalone) {
    return (
      <div className="rounded-2xl border border-fuchsia-500/30 bg-slate-900/50 p-5 text-sm text-slate-200">
        <p className="font-semibold">Dernière étape sur iPhone</p>
        <p className="mt-2 text-slate-300">
          Apple demande que Mission Control soit installée à l&apos;écran d&apos;accueil avant
          d&apos;activer les notifications. Suis le guide juste au-dessus, puis rouvre l&apos;app
          depuis ton icône.
        </p>
      </div>
    );
  }

  const permission = env.permission;
  const subscribed = permission === 'granted' && count !== null && count > 0;

  async function onEnable() {
    setStatus('working');
    setMessage('');
    const res = await subscribeToPush();
    if (res.ok) {
      setStatus('ok');
      setMessage('Notifications activées sur ce téléphone.');
    } else {
      setStatus('error');
      setMessage(res.reason);
    }
    refresh();
  }

  async function onDisable() {
    setStatus('working');
    setMessage('');
    await unsubscribeFromPush();
    setStatus('ok');
    setMessage('Notifications désactivées sur ce téléphone.');
    refresh();
  }

  async function onTest() {
    setStatus('working');
    setMessage('');
    const r = await sendTestPush();
    if (r.ok) {
      if ((r.sent ?? 0) > 0) {
        setStatus('ok');
        setMessage(`Push envoyé à ${r.sent} device(s). Regarde ton téléphone.`);
      } else {
        setStatus('error');
        setMessage('Aucun device abonné. Active d\'abord les notifications ci-dessus.');
      }
    } else {
      setStatus('error');
      setMessage(r.reason || 'Erreur inconnue');
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-slate-100 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-fuchsia-300">Notifications push</p>
          <h3 className="mt-1 text-lg font-bold">Alertes sur ton téléphone</h3>
          <p className="mt-1 text-sm text-slate-300">
            Reçois un push natif quand quelqu&apos;un t&apos;écrit, même sans ouvrir l&apos;app.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            subscribed
              ? 'bg-emerald-500/15 text-emerald-300'
              : permission === 'denied'
              ? 'bg-rose-500/15 text-rose-300'
              : 'bg-slate-700/40 text-slate-300'
          }`}
        >
          {subscribed ? 'Activées' : permission === 'denied' ? 'Bloquées' : 'Inactives'}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!subscribed && permission !== 'denied' && (
          <button
            onClick={onEnable}
            disabled={status === 'working'}
            className="rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-60"
          >
            {status === 'working' ? 'Activation…' : 'Activer les notifications'}
          </button>
        )}
        {subscribed && (
          <>
            <button
              onClick={onTest}
              disabled={status === 'working'}
              className="rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-60"
            >
              {status === 'working' ? 'Envoi…' : 'Envoyer un push de test'}
            </button>
            <button
              onClick={onDisable}
              disabled={status === 'working'}
              className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-60"
            >
              Désactiver
            </button>
          </>
        )}
        {permission === 'denied' && (
          <p className="text-xs text-rose-300">
            Les notifications sont bloquées au niveau du navigateur. Va dans les réglages du site
            (icône cadenas dans la barre d&apos;adresse) et autorise les notifications, puis
            recharge la page.
          </p>
        )}
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${
            status === 'error' ? 'text-rose-300' : 'text-emerald-300'
          }`}
        >
          {message}
        </p>
      )}

      {count !== null && count > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {count} device{count > 1 ? 's' : ''} enregistré{count > 1 ? 's' : ''} sur ton compte.
        </p>
      )}
    </div>
  );
}
