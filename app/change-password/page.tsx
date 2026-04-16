'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword, getStoredUser, setStoredUser } from '@/lib/api';

export default function ChangePasswordPage() {
  const router = useRouter();
  const user = getStoredUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) return setError('Le nouveau mot de passe doit avoir au moins 8 caractères.');
    if (newPassword !== confirmPassword) return setError('Les deux mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      if (user) setStoredUser({ ...user, mustChangePassword: false });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Impossible de changer le mot de passe.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center px-6 py-12">
      <div className="absolute inset-0 cosmic-grid" />
      <div className="blob bg-neon-violet w-[480px] h-[480px] -top-32 -left-24 animate-pulse-slow" />
      <div className="blob bg-neon-cyan w-[380px] h-[380px] -bottom-24 -right-24 animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold font-display mb-2">
            <span className="grad-text">Nouveau mot de passe</span>
          </h1>
          <p className="text-white/50 text-sm">
            Pour ta sécurité, choisis un nouveau mot de passe avant de continuer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 space-y-5">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
              Mot de passe actuel
            </label>
            <input
              type="password"
              className="input"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-white/40 mt-1.5">Au moins 8 caractères.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider">
              Confirmer
            </label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            <span>{loading ? <span className="spinner" /> : 'Mettre à jour'}</span>
          </button>
        </form>
      </div>
    </main>
  );
}
