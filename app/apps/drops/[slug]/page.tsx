'use client';

// /apps/drops/[slug]/page.tsx — wrapper Next.js qui iframe le HTML d'un drop.
// L'iframe charge `${API_URL}/heimdall/drops/:slug/content?token=...` (auth via JWT
// passe en query string puisque les iframes ne peuvent pas envoyer headers custom).

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { getStoredUser } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

export default function DropWrapper() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || '';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ title: string; iconEmoji: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) { router.push('/'); return; }
    if (!slug) return;
    // Fetch metadata (titre + icon) depuis /me/drops
    (async () => {
      try {
        const token = localStorage.getItem('mc_token');
        const res = await fetch(`${API_URL}/heimdall/me/drops`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const drop = (data.drops || []).find((d: any) => d.slug === slug);
        if (!drop) {
          setError('Pas d\'accès à ce drop ou drop introuvable.');
          return;
        }
        setMeta({ title: drop.title, iconEmoji: drop.iconEmoji || '📦' });
      } catch (e: any) {
        setError(e?.message || 'Erreur chargement métadonnées');
      }
    })();
  }, [slug, router]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('mc_token') : null;
  const contentUrl = `${API_URL}/heimdall/drops/${encodeURIComponent(slug)}/content${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  if (error) {
    return (
      <main className="min-h-[100dvh] bg-cosmos-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-rose-300 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-xl border border-white/20 text-white hover:bg-white/5"
          >
            Retour
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-cosmos-950 z-0" style={{ height: '100dvh' }}>
      <header
        className="relative flex items-center gap-2 px-3 pb-2 border-b border-white/10 bg-cosmos-950/85 backdrop-blur-md flex-shrink-0"
        style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Retour"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-sm" />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xl">{meta?.iconEmoji || '📦'}</span>
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 leading-tight">DROP</p>
            <p className="font-semibold text-sm text-white truncate leading-tight">{meta?.title || slug}</p>
          </div>
        </div>
        <button
          onClick={() => {
            if (iframeRef.current) {
              setLoading(true);
              iframeRef.current.src = iframeRef.current.src;
            }
          }}
          className="w-10 h-10 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          aria-label="Rafraîchir"
        >
          <FontAwesomeIcon icon={faRotateRight} className="text-sm" />
        </button>
      </header>

      <div className="relative flex-1 w-full">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-cosmos-950 z-10 pointer-events-none">
            <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={contentUrl}
          className="absolute inset-0 w-full h-full border-0 bg-cosmos-950"
          title={meta?.title || slug}
          allow="clipboard-read; clipboard-write; fullscreen; autoplay"
          onLoad={() => setLoading(false)}
        />
      </div>
    </main>
  );
}
