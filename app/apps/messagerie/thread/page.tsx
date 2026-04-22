import { Suspense } from 'react';
import Thread from './Thread';

export const metadata = {
  title: 'Conversation — Mission Control',
};

// Route statique (compatible output:'export'). L'ID de la convo arrive via ?id=N.
export default function ThreadPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Chargement…
        </main>
      }
    >
      <Thread />
    </Suspense>
  );
}
