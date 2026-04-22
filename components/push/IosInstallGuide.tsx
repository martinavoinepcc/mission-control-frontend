'use client';

import { useEffect, useState } from 'react';
import { detectPushEnv } from '@/lib/push-api';

/**
 * Affiche un pas-à-pas « Ajouter à l'écran d'accueil » sur iPhone/iPad si la PWA
 * n'est pas encore installée. Sans cette étape, Apple n'active pas les Web Push.
 *
 * Peut être monté sur le dashboard en bannière, ou dans la page Profil en bloc.
 */
export default function IosInstallGuide({ compact = false }: { compact?: boolean }) {
  const [env, setEnv] = useState<ReturnType<typeof detectPushEnv> | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setEnv(detectPushEnv());
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem('mc_ios_install_dismissed') === '1');
    }
  }, []);

  if (!env) return null;
  if (!env.ios) return null;
  if (env.standalone) return null; // déjà installée — parfait
  if (dismissed && compact) return null;

  const dismiss = () => {
    localStorage.setItem('mc_ios_install_dismissed', '1');
    setDismissed(true);
  };

  if (!env.iosVersionOk) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <p className="font-semibold">iOS 16.4+ requis pour les notifications</p>
        <p className="mt-1 opacity-90">
          Tu es sur une version d&apos;iOS plus ancienne. Mets-toi à jour (Réglages → Général → Mise à
          jour logicielle) pour recevoir les alertes Mission Control.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-5 text-slate-100 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-sky-300">Configuration iPhone</p>
          <h3 className="mt-1 text-lg font-bold">
            Installe Mission Control sur ton iPhone
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            Obligatoire pour recevoir les notifications. 30 secondes.
          </p>
        </div>
        {compact && (
          <button
            onClick={dismiss}
            aria-label="Fermer"
            className="rounded-full bg-slate-800/80 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            ✕
          </button>
        )}
      </div>

      <ol className="mt-4 space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/20 font-bold text-sky-200">
            1
          </span>
          <span className="pt-0.5">
            En bas de l&apos;écran Safari, touche l&apos;icône{' '}
            <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 font-semibold">
              Partager
            </span>{' '}
            (le carré avec la flèche vers le haut).
          </span>
        </li>
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/20 font-bold text-sky-200">
            2
          </span>
          <span className="pt-0.5">
            Fais défiler puis choisis{' '}
            <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 font-semibold">
              Sur l&apos;écran d&apos;accueil
            </span>
            .
          </span>
        </li>
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/20 font-bold text-sky-200">
            3
          </span>
          <span className="pt-0.5">
            Touche{' '}
            <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 font-semibold">
              Ajouter
            </span>{' '}
            en haut à droite.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/20 font-bold text-sky-200">
            4
          </span>
          <span className="pt-0.5">
            Ouvre l&apos;icône{' '}
            <span className="font-semibold text-sky-200">Mission Control</span> depuis ton écran
            d&apos;accueil, connecte-toi, puis reviens sur ton profil pour activer les
            notifications.
          </span>
        </li>
      </ol>

      {compact && (
        <button
          onClick={dismiss}
          className="mt-4 text-xs text-slate-400 underline underline-offset-2 hover:text-slate-200"
        >
          Ne plus afficher sur ce téléphone
        </button>
      )}
    </div>
  );
}
