'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStoredUser, type User } from '@/lib/api';
import IosInstallGuide from '@/components/push/IosInstallGuide';
import PushPermissionPrompt from '@/components/push/PushPermissionPrompt';

export default function ProfilClient() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    setUser(u);
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-300">
        Chargement du profil…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-300">
        <p className="mb-4">Tu dois être connecté pour voir ton profil.</p>
        <Link href="/login" className="text-fuchsia-400 underline">
          Se connecter
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 pb-24 text-slate-100 sm:p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-fuchsia-300">Profil</p>
            <h1 className="mt-1 text-2xl font-bold">Bonjour {user.firstName}</h1>
            <p className="text-sm text-slate-400">
              {user.role === 'ADMIN' ? 'Administrateur' : 'Membre'} · {user.profile === 'CHILD' ? 'Enfant' : 'Adulte'}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            ← Dashboard
          </Link>
        </header>

        <section className="grid gap-4">
          <IosInstallGuide />
          <PushPermissionPrompt />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-300">
          <h2 className="text-base font-semibold text-slate-100">Informations du compte</h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-500">Courriel</dt>
              <dd className="mt-0.5">{user.email}</dd>
            </div>
            {user.username && (
              <div>
                <dt className="text-xs uppercase text-slate-500">Nom d&apos;utilisateur</dt>
                <dd className="mt-0.5">{user.username}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4">
            <Link
              href="/change-password"
              className="text-sm text-fuchsia-400 underline underline-offset-2 hover:text-fuchsia-300"
            >
              Changer mon mot de passe
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
