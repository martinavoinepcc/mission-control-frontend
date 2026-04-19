'use client';

// Wrapper Next.js pour le mockup HTML standalone Kaz S2.
// Identique au pattern S1.

export default function KazSurvieXpS2Page() {
  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      <iframe
        src="/mockups/kaz-survie-xp-s2.html"
        className="w-full h-full border-0"
        allow="autoplay"
        title="Kaz S2 — Le cookie qui soigne"
      />
    </main>
  );
}
