'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, setToken, setStoredUser } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await login(email, password);
      setToken(token);
      setStoredUser(user);
      if (user.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de se connecter.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center px-6 py-12">
      {/* Fond cosmique */}
      <div className="absolute inset-0 cosmic-grid" />
      <div className="blob bg-neon-violet w-[520px] h-[520px] -top-40 -left-32 animate-pulse-slow" />
      <div className="blob bg-neon-cyan w-[420px] h-[420px] -bottom-32 -right-24 animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      <div className="blob bg-neon-pink w-[320px] h-[320px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30" />

      {/* Bloc logo + card */}
      <div className={`relative w-full max-w-md ${mounted ? 'animate-fade-up' : 'opacity-0'}`}>
        {/* Logo flottant */}
        <div className="flex flex-col items-center mb-8 select-none">
          <div className="relative mb-5 animate-float">
            <div className="absolute inset-0 bg-gradient-to-br from-neon-violet to-neon-cyan rounded-2xl blur-2xl opacity-60" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-violet to-neon-cyan flex items-center justify-center animate-glow">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight">
            <span className="grad-text">My Mission Control</span>
          </h1>
          <p className="text-sm text-white/50 mt-2 tracking-wide">Portail privé · Accès membres seulement</p>
        </div>

        {/* Card login */}
        <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 space-y-5">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider" htmlFor="email">
              Courriel
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wider" htmlFor="password">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="input pr-12"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 text-xs px-2 py-1 rounded transition"
                aria-label="Afficher/masquer le mot de passe"
              >
                {showPwd ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
            <span>{loading ? <span className="spinner" /> : 'Se connecter'}</span>
          </button>

          <p className="text-center text-xs text-white/30 pt-2">
            Accès restreint · Si tu as oublié ton mot de passe, demande à Martin.
          </p>
        </form>

        {/* Footer */}
        <p className="text-center text-[11px] text-white/25 mt-8 tracking-wide">
          © {new Date().getFullYear()} Famille Avoine-Blanchette · my-mission-control.com
        </p>
      </div>
    </main>
  );
}
