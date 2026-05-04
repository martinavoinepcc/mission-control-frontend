'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faRotateRight, faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

const COCKPIT_URL =
  process.env.NEXT_PUBLIC_HEIMDALL_COCKPIT_URL ||
  'https://mission-control-heimdall.onrender.com';

export default function CockpitPage() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  return (
    <main
      className="fixed inset-0 flex flex-col bg-cosmos-950 z-0"
      style={{ height: '100dvh' }}
    >
      {/* Top bar avec safe-area iPhone */}
      <header
        className="relative flex items-center gap-2 px-3 pb-2 border-b border-white/10 bg-cosmos-950/85 backdrop-blur-md flex-shrink-0"
        style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => router.push('/apps/heimdall/')}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Retour HEIMDALL"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-sm" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 leading-tight">HEIMDALL</p>
          <p className="font-display font-semibold text-sm text-white truncate leading-tight">Cockpit Aion UI</p>
        </div>
        <button
          onClick={() => {
            if (iframeRef.current) {
              setLoading(true);
              // Force reload meme cross-origin
              iframeRef.current.src = iframeRef.current.src;
            }
          }}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Rafraichir"
          title="Rafraichir le cockpit"
        >
          <FontAwesomeIcon icon={faRotateRight} className="text-sm" />
        </button>
        <button
          onClick={() => window.open(COCKPIT_URL, '_blank', 'noopener,noreferrer')}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Ouvrir dans Safari"
          title="Ouvrir en plein dans Safari"
        >
          <FontAwesomeIcon icon={faUpRightFromSquare} className="text-sm" />
        </button>
      </header>

      {/* Iframe Aion UI */}
      <div className="relative flex-1 w-full">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-cosmos-950 z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              <p className="text-white/40 text-xs uppercase tracking-[0.2em]">Connexion au cockpit</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={COCKPIT_URL}
          className="absolute inset-0 w-full h-full border-0 bg-cosmos-950"
          title="Aion UI - Cockpit complet"
          allow="clipboard-read; clipboard-write; fullscreen"
          onLoad={() => setLoading(false)}
        />
      </div>
    </main>
  );
}
