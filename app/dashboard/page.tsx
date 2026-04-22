'use client';



import { useEffect, useState, useMemo, Suspense } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { getMe, clearToken, type User, type App } from '@/lib/api';

import { UI, iconForApp } from '@/lib/icons';

import { WeatherWidget } from '@/components/WeatherWidget';
import PushBanner from '@/components/push/PushBanner';
import { listConversations } from '@/lib/messagerie-api';

// Ordre de priorité des tuiles dans le dashboard — messagerie d'abord.
const APP_PRIORITY: Record<string, number> = {
  messagerie: 0,
  educatif: 10,
  maison: 20,
  chalet: 30,
  assistant: 40,
  qscale: 50,
  logifox: 60,
};



type Realm = 'FAMILY' | 'WORK';



function DashboardInner() {

  const router = useRouter();

  const params = useSearchParams();

  const realmParam = (params.get('realm') || 'family').toUpperCase() as Realm;

  const realm: Realm = realmParam === 'WORK' ? 'WORK' : 'FAMILY';



  const [user, setUser] = useState<User | null>(null);

  const [apps, setApps] = useState<App[]>([]);

  const [loading, setLoading] = useState(true);

  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [hasMessagerie, setHasMessagerie] = useState<boolean>(false);



  useEffect(() => {

    (async () => {

      try {

        const data = await getMe();

        setUser(data.user);

        setApps(data.apps);

        if (data.user.mustChangePassword) router.push('/change-password');

      } catch {

        clearToken();

        router.push('/');

      } finally {

        setLoading(false);

      }

    })();

  }, [router]);



  function handleLogout() { clearToken(); router.push('/'); }



  const filteredApps = useMemo(

    () => apps

      .filter((a) => (a.realm || 'FAMILY') === realm)

      .slice()

      .sort((a, b) => {

        const pa = APP_PRIORITY[a.slug] ?? 999;

        const pb = APP_PRIORITY[b.slug] ?? 999;

        return pa - pb;

      }),

    [apps, realm]

  );



  useEffect(() => {

    setHasMessagerie(apps.some((a) => a.slug === 'messagerie'));

  }, [apps]);



  // Compteur non-lus dans le header (poll 30s, sans bruit si échec)

  useEffect(() => {

    if (!hasMessagerie) { setUnreadTotal(0); return; }

    let cancelled = false;

    const pull = async () => {

      try {

        const convos = await listConversations();

        if (cancelled) return;

        setUnreadTotal(convos.reduce((acc, c) => acc + (c.unreadCount || 0), 0));

      } catch {

        /* silencieux */

      }

    };

    pull();

    const t = window.setInterval(() => {

      if (document.visibilityState === 'visible') pull();

    }, 30000);

    const onVis = () => { if (document.visibilityState === 'visible') pull(); };

    document.addEventListener('visibilitychange', onVis);

    return () => {

      cancelled = true;

      window.clearInterval(t);

      document.removeEventListener('visibilitychange', onVis);

    };

  }, [hasMessagerie]);



  const hasMultipleRealms = useMemo(() => {

    const set = new Set(apps.map((a) => a.realm || 'FAMILY'));

    return set.size > 1;

  }, [apps]);



  // Vibe tokens per realm. Keep class strings literal so Tailwind JIT picks them up.

  const isWork = realm === 'WORK';

  const vibe = isWork

    ? {

        label: 'Travail',

        greeting: 'Focus',

        sub: 'Espace de travail — zen, sérieux, concentré.',

        gradient: 'from-slate-300 to-sky-400',

        blob1: 'bg-slate-500',

        blob2: 'bg-sky-500',

        adminBtn: 'border-sky-400/30 text-sky-300/90 hover:bg-sky-400/10',

        backBtn: 'border-slate-400/30 text-slate-300/90 hover:bg-slate-400/10',

      }

    : {

        label: 'Famille',

        greeting: 'Bonjour',

        sub: 'Voici tes applications disponibles.',

        gradient: 'from-neon-violet to-neon-cyan',

        blob1: 'bg-neon-violet',

        blob2: 'bg-neon-cyan',

        adminBtn: 'border-neon-violet/30 text-neon-violet/90 hover:bg-neon-violet/10',

        backBtn: 'border-white/15 text-white/70 hover:bg-white/5',

      };



  if (loading) {

    return (

      <main className="relative min-h-screen flex items-center justify-center">

        <div className="absolute inset-0 cosmic-grid" />

        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />

      </main>

    );

  }



  if (!user) return null;



  return (

    <main className="relative min-h-screen">

      <div className={`absolute inset-0 cosmic-grid ${isWork ? 'opacity-50' : ''}`} />

      {!isWork && (

        <>

          <div className="blob bg-neon-violet w-[480px] h-[480px] -top-32 -left-24 animate-pulse-slow" />

          <div className="blob bg-neon-cyan w-[400px] h-[400px] -bottom-32 -right-24 animate-pulse-slow" style={{ animationDelay: '2s' }} />

        </>

      )}

      {isWork && (

        <div className="blob bg-sky-600 w-[320px] h-[320px] -top-20 right-10 opacity-30 animate-pulse-slow" />

      )}



      <div

        className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-6 sm:pb-10"

        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}

      >

        {/* Header */}

        <header className="flex items-center justify-between gap-2 mb-8 sm:mb-12 animate-fade-up">

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">

            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-cosmos-950">

              {/* eslint-disable-next-line @next/next/no-img-element */}

              <img

                src="/logo/mc-logo-80.png"

                alt="Mission Control"

                draggable={false}

                className="w-10 h-10 object-contain"

              />

            </div>

            <span className="font-display font-semibold text-lg hidden sm:inline">Mission Control</span>

            <span className="hidden sm:inline-flex text-[10px] uppercase tracking-[0.25em] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 flex-shrink-0">

              {vibe.label}

            </span>

          </div>

          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">

            {hasMultipleRealms && (

              <button

                onClick={() => router.push('/realms')}

                className={`text-sm w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-xl border transition flex items-center justify-center sm:gap-2 ${vibe.backBtn}`}

                title="Changer d'espace"

                aria-label="Espaces"

              >

                <FontAwesomeIcon icon={UI.compass} className="text-sm sm:text-xs" />

                <span className="hidden sm:inline">Espaces</span>

              </button>

            )}

            {user.role === 'ADMIN' && (

              <button

                onClick={() => router.push('/admin')}

                className={`text-sm w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-xl border transition flex items-center justify-center sm:gap-2 ${vibe.adminBtn}`}

                aria-label="Administration"

              >

                <FontAwesomeIcon icon={UI.admin} className="text-sm sm:text-xs" />

                <span className="hidden sm:inline">Administration</span>

              </button>

            )}

            {hasMessagerie && (

              <button

                onClick={() => router.push('/apps/messagerie/')}

                className="relative text-sm w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-xl border border-sky-400/30 text-sky-200 hover:bg-sky-400/10 transition flex items-center justify-center sm:gap-2"

                aria-label={`Messagerie${unreadTotal > 0 ? ` (${unreadTotal} non lus)` : ''}`}

                title="Messagerie"

              >

                <FontAwesomeIcon icon={UI.comments} className="text-sm sm:text-xs" />

                <span className="hidden sm:inline">Messagerie</span>

                {unreadTotal > 0 && (

                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-slate-950">

                    {unreadTotal > 99 ? '99+' : unreadTotal}

                  </span>

                )}

              </button>

            )}

            <button

              onClick={() => router.push('/profil')}

              className="text-sm w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center sm:gap-2"

              aria-label="Profil et notifications"

            >

              <FontAwesomeIcon icon={UI.user} className="text-sm sm:text-xs" />

              <span className="hidden sm:inline">Profil</span>

            </button>

            <button

              onClick={handleLogout}

              className="text-sm w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center sm:gap-2"

              aria-label="Déconnexion"

            >

              <FontAwesomeIcon icon={UI.logout} className="text-sm sm:text-xs" />

              <span className="hidden sm:inline">Déconnexion</span>

            </button>

          </div>

        </header>



        {/* Salutation + météo */}

        <section className="mb-10 animate-fade-up">

          <div className="flex items-start justify-between gap-4 flex-wrap">

            <div className="min-w-0">

              <p className="text-white/40 text-sm tracking-wider uppercase mb-2">{vibe.label}</p>

              <h1 className="text-4xl md:text-5xl font-bold font-display">

                {vibe.greeting}, <span className={`bg-gradient-to-r ${vibe.gradient} bg-clip-text text-transparent`}>{user.firstName}</span>

              </h1>

              <p className="text-white/50 mt-3">{vibe.sub}</p>

            </div>

            {!isWork && (

              <div className="flex-shrink-0 mt-2">

                <WeatherWidget variant="compact" accentColor="#38BDF8" />

              </div>

            )}

          </div>

        </section>



        {/* Bannière d'activation des notifs — visible sur le dashboard FAMILY seulement */}

        {!isWork && <PushBanner />}



        {/* Grille d'apps */}

        {filteredApps.length === 0 ? (

          <div className="glass rounded-2xl p-8 text-center text-white/60">

            Aucune application disponible dans cet espace.

          </div>

        ) : (

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {filteredApps.map((app, idx) => (

              <AppCard key={app.id} app={app} delay={idx * 80} realm={realm} />

            ))}

          </div>

        )}

      </div>

    </main>

  );

}



export default function DashboardPage() {

  return (

    <Suspense fallback={

      <main className="relative min-h-screen flex items-center justify-center">

        <div className="absolute inset-0 cosmic-grid" />

        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />

      </main>

    }>

      <DashboardInner />

    </Suspense>

  );

}



function AppCard({ app, delay, realm }: { app: App; delay: number; realm: Realm }) {
  // Classes partagees pour le look de la tuile (button ET anchor)
  const cardClass = "group relative text-left rounded-2xl overflow-hidden glass p-6 transition-all hover:scale-[1.02] hover:shadow-2xl animate-fade-up block";
  const cardStyle = { animationDelay: `${delay}ms` } as React.CSSProperties;

  // Contenu visuel reutilise dans toutes les variantes
  const inner = (
    <>
      <div
        className="absolute inset-0 opacity-20 transition-opacity group-hover:opacity-35"
        style={{ background: `radial-gradient(circle at 30% 20%, ${app.color}, transparent 70%)` }}
      />
      <div className="relative">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 transition-transform group-hover:scale-110"
          style={{ background: `${app.color}20`, border: `1px solid ${app.color}40` }}
        >
          <FontAwesomeIcon icon={iconForApp(app.icon)} className="text-2xl" style={{ color: app.color }} />
        </div>
        <h3 className="font-display text-xl font-semibold mb-1">{app.name}</h3>
        {app.description && <p className="text-white/50 text-sm mb-4">{app.description}</p>}
        {app.isMockup && (
          <span className="inline-block text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
            Bientôt disponible
          </span>
        )}
      </div>
    </>
  );

  // Launcher externe : vrai <a target="_blank"> — plus fiable que window.open sur mobile
  if (!app.isMockup && app.url) {
    return (
      <a
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClass}
        style={cardStyle}
      >
        {inner}
      </a>
    );
  }

  // Mockup ou app interne : button + logique onClick
  return (
    <button
      onClick={() => {
        if (app.isMockup) {
          alert(`${app.name}

Bientôt disponible.`);
          return;
        }
        if (app.slug === 'educatif') window.location.href = '/apps/educatif/';
        else if (app.slug === 'maison') window.location.href = '/apps/maison/';
        else if (app.slug === 'chalet') window.location.href = '/apps/chalet/';
        else if (app.slug === 'messagerie') window.location.href = '/apps/messagerie/';
      }}
      className={cardClass}
      style={cardStyle}
    >
      {inner}
    </button>
  );
}

