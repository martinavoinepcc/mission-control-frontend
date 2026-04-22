'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getStoredUser,
  getMe,
  setStoredUser,
  uploadAvatar,
  deleteAvatar,
  type User,
} from '@/lib/api';
import IosInstallGuide from '@/components/push/IosInstallGuide';
import PushPermissionPrompt from '@/components/push/PushPermissionPrompt';
import Avatar from '@/components/Avatar';
import { humanBytes } from '@/lib/image-utils';
import AvatarCropModal, { type CropResult } from '@/components/AvatarCropModal';

type SaveState = 'idle' | 'compressing' | 'uploading' | 'ok' | 'error';

export default function ProfilClient() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMsg, setSaveMsg] = useState<string>('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Lit le user local d'abord pour un affichage instantané
    const cached = getStoredUser();
    setUser(cached);
    setLoaded(true);
    // Puis refresh depuis le serveur pour avoir l'avatar le plus frais
    getMe()
      .then((data) => {
        setUser(data.user);
        setStoredUser(data.user);
      })
      .catch(() => {
        /* silencieux — on garde le cache */
      });
  }, []);

  if (!loaded) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-300">Chargement du profil…</main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-300">
        <p className="mb-4">Tu dois être connecté pour voir ton profil.</p>
        <Link href="/login" className="text-sky-400 underline">
          Se connecter
        </Link>
      </main>
    );
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSaveState('error');
      setSaveMsg('Fichier non supporté (image requise).');
      return;
    }
    setSaveState('idle');
    setSaveMsg('');
    setPendingFile(file); // ouvre le crop modal
  }

  async function onCropConfirm(result: CropResult) {
    try {
      setPendingFile(null);
      setSaveState('uploading');
      setSaveMsg(`Envoi (${humanBytes(result.bytes)})…`);
      const res = await uploadAvatar(result.dataUrl);
      const updated: User = {
        ...user!,
        avatarData: res.avatarData,
        avatarUpdatedAt: res.avatarUpdatedAt,
      };
      setUser(updated);
      setStoredUser(updated);
      setSaveState('ok');
      setSaveMsg('Photo mise à jour ✓');
      window.setTimeout(() => setSaveMsg(''), 2200);
    } catch (err: any) {
      setSaveState('error');
      setSaveMsg(err?.message || 'Erreur de téléversement');
    }
  }

  async function onRemove() {
    try {
      setSaveState('uploading');
      setSaveMsg('Retrait…');
      await deleteAvatar();
      const updated: User = { ...user!, avatarData: null };
      setUser(updated);
      setStoredUser(updated);
      setSaveState('ok');
      setSaveMsg('Photo retirée ✓');
      window.setTimeout(() => setSaveMsg(''), 2000);
    } catch (err: any) {
      setSaveState('error');
      setSaveMsg(err?.message || 'Erreur');
    }
  }

  const busy = saveState === 'compressing' || saveState === 'uploading';

  return (
    <main className="min-h-screen bg-slate-950 pb-24 text-slate-100">
      <div
        className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/85 backdrop-blur-md"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pb-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-sky-300">Profil</p>
            <h1 className="text-lg font-bold">Bonjour {user.firstName}</h1>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-5 p-4 sm:p-6">
        {/* Carte Avatar */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Avatar userId={user.id} firstName={user.firstName} src={user.avatarData || null} size={80} />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-sky-300">Photo de profil</p>
              <p className="text-sm text-slate-300">
                Visible dans la messagerie et les notifications push.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60"
            >
              {user.avatarData ? 'Changer la photo' : 'Ajouter une photo'}
            </button>
            {user.avatarData && (
              <button
                onClick={onRemove}
                disabled={busy}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-60"
              >
                Retirer
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          {saveMsg && (
            <p
              className={`mt-3 text-xs ${
                saveState === 'error' ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {saveMsg}
            </p>
          )}
          <p className="mt-3 text-[11px] text-slate-500">
            L&apos;image est redimensionnée en 256×256 webp (~25 KB) et stockée dans ta base de
            données privée. Jamais envoyée à un service tiers.
          </p>
        </section>

        <section className="grid gap-4">
          <IosInstallGuide />
          <PushPermissionPrompt />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-300">
          <h2 className="text-base font-semibold text-slate-100">Informations du compte</h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-500">Courriel</dt>
              <dd className="mt-0.5 break-all">{user.email}</dd>
            </div>
            {user.username && (
              <div>
                <dt className="text-xs uppercase text-slate-500">Nom d&apos;utilisateur</dt>
                <dd className="mt-0.5">{user.username}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase text-slate-500">Rôle</dt>
              <dd className="mt-0.5">
                {user.role === 'ADMIN' ? 'Administrateur' : 'Membre'} ·{' '}
                {user.profile === 'CHILD' ? 'Enfant' : 'Adulte'}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <Link
              href="/change-password"
              className="text-sm text-sky-400 underline underline-offset-2 hover:text-sky-300"
            >
              Changer mon mot de passe
            </Link>
          </div>
        </section>
      </div>

      {/* Crop modal — s'ouvre quand l'utilisateur a choisi un fichier image */}
      {pendingFile && (
        <AvatarCropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onConfirm={onCropConfirm}
        />
      )}
    </main>
  );
}
