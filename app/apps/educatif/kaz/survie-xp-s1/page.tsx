'use client';

// Niveau 1 : Survie XP — Variables (Scene 1)
// Wrapper Next.js qui charge le mockup standalone full-screen via iframe.

import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';

export default function KazSurvieXpS1Page() {
  const router = useRouter();

  return (
    <main className="relative min-h-screen bg-black">
      <div className="absolute top-3 left-3 z-20">
        <button
          onClick={() => router.push('/apps/educatif/kaz')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/70 backdrop-blur-sm text-white/80 hover:text-white text-sm border border-white/10 hover:border-white/30 transition-all"
        >
          <FontAwesomeIcon icon={UI.back} /> Retour
        </button>
      </div>
      <iframe
        src="/mockups/kaz-survie-xp-s1.html"
        className="w-screen h-screen border-0 block"
        title="Kaz & Moi — Survie XP S1"
        allow="autoplay; fullscreen"
      />
    </main>
  );
}
