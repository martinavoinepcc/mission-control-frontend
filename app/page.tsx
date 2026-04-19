'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { login, setToken, setStoredUser } from '@/lib/api';
import { UI } from '@/lib/icons';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [statusText, setStatusText] = useState('SYSTEM READY');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Particle canvas — fond technique
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    const particles: P[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.8 + 0.3,
      a: Math.random() * 0.6 + 0.2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Lignes entre particules proches
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 140) {
            ctx.strokeStyle = `rgba(155, 109, 255, ${0.15 * (1 - d / 140)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      // Points
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.fillStyle = `rgba(94, 234, 255, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStatusText('AUTHENTIFICATION...');
    try {
      const { token, user } = await login(identifier, password);
      setToken(token);
      setStoredUser(user);
      setStatusText('ACCÈS ACCORDÉ');
      await new Promise((r) => setTimeout(r, 500));
      if (user.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setStatusText('ACCÈS REFUSÉ');
      setError(err.message || 'Impossible de se connecter.');
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden flex items-center justify-center px-6 py-12">
      {/* Canvas particules */}
      <canvas ref={canvasRef} className="absolute inset-0" style={{ opacity: 0.6 }} />

      {/* Fond cosmique */}
      <div className="absolute inset-0 cosmic-grid" />
      <div className="blob bg-neon-violet w-[520px] h-[520px] -top-40 -left-32 animate-pulse-slow" />
      <div className="blob bg-neon-cyan w-[420px] h-[420px] -bottom-32 -right-24 animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      <div className="blob bg-neon-pink w-[320px] h-[320px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30" />

      {/* Bloc logo + card */}
      <div className={`relative w-full max-w-md ${mounted ? '' : 'opacity-0'}`}>
        {/* Logo + orbital rings */}
        <div className="flex flex-col items-center mb-8 select-none po-1">
          <div className="relative mb-6 w-32 h-32 flex items-center justify-center">
            {/* Grille tech derrière */}
            <div className="tech-grid-bg" />
            {/* Orbital rings */}
            <div className="orbital-ring w-32 h-32" />
            <div className="orbital-ring reverse w-24 h-24" />
            {/* Halo */}
            <div className="absolute w-16 h-16 bg-gradient-to-br from-neon-violet to-neon-cyan rounded-2xl blur-2xl opacity-70" />
            {/* Logo */}
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-violet to-neon-cyan flex items-center justify-center animate-glow">
              <FontAwesomeIcon icon={UI.compass} className="text-white text-2xl" />
            </div>
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight glitch">
            <span className="grad-text">My Mission Control</span>
          </h1>
          <p className="text-sm text-white/50 mt-2 tracking-[0.25em] uppercase">Portail privé</p>
          {/* Status line type terminal */}
          <div className="mt-4 flex items-center gap-2 text-[10px] font-mono tracking-wider">
            <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-300' : error ? 'bg-red-400' : 'bg-emerald-400'} animate-pulse`} />
            <span key={statusText} className="typewriter text-white/60">{statusText}</span>
          </div>
        </div>

        {/* Card login avec coins HUD + scanline */}
        <form onSubmit={handleSubmit} className="glass relative rounded-3xl p-8 space-y-5 po-2 overflow-hidden">
          <div className="hud-corner tl" />
          <div className="hud-corner tr" />
          <div className="hud-corner bl" />
          <div className="hud-corner br" />
          <div className="scanline" />

          <div className="relative">
            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-[0.18em] flex items-center gap-2" htmlFor="identifier">
              <FontAwesomeIcon icon={UI.envelope} className="text-neon-cyan text-[11px]" />
              Nom d'utilisateur
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              required
              className="input"
              placeholder="Jax, Ali, MJ ou courriel"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-[0.18em] flex items-center gap-2" htmlFor="password">
              <FontAwesomeIcon icon={UI.lock} className="text-neon-cyan text-[11px]" />
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/90 p-2 rounded transition"
                aria-label="Afficher/masquer le mot de passe"
              >
                <FontAwesomeIcon icon={showPwd ? UI.eyeSlash : UI.eye} className="text-sm" />
              </button>
            </div>
          </div>

          {loading && <div className="auth-bar" />}

          {error && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
              <FontAwesomeIcon icon={UI.close} />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full flex items-center justify-center gap-2"
            disabled={loading}
          >
            <span className="flex items-center gap-2">
              {loading ? (
                <>
                  <FontAwesomeIcon icon={UI.spinner} spin className="text-sm" />
                  Vérification
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={UI.shield} className="text-sm" />
                  Initier la connexion
                </>
              )}
            </span>
          </button>

          <p className="text-center text-[10px] text-white/30 pt-2 tracking-wider uppercase">
            Accès restreint · Oublié ton mdp ? Demande à Martin.
          </p>
        </form>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/25 mt-8 tracking-[0.2em] uppercase po-3">
          © {new Date().getFullYear()} Avoine-Blanchette · my-mission-control.com
        </p>
      </div>
    </main>
  );
}
