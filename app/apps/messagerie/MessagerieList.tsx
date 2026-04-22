'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';
import { getStoredUser, type User as MeUser } from '@/lib/api';
import {
  listConversations,
  conversationDisplayName,
  formatTime,
  type ConversationSummary,
} from '@/lib/messagerie-api';

export default function MessagerieList() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [convos, setConvos] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listConversations();
      setConvos(list);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    }
  }, []);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      router.push('/');
      return;
    }
    setUser(u);
    load();
    // Poll léger toutes les 15 s quand l'onglet est visible
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 15000);
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, router]);

  if (!user) return null;

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      <div className="mx-auto max-w-2xl px-4 py-5 sm:py-8">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/dashboard')}
              aria-label="Retour"
              className="w-11 h-11 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
            >
              <FontAwesomeIcon icon={UI.back} />
            </button>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-fuchsia-300">Messagerie</p>
              <h1 className="text-xl sm:text-2xl font-bold truncate">Conversations</h1>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {convos === null ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
            Chargement…
          </div>
        ) : convos.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-400">
            Aucune conversation pour l&apos;instant.
          </div>
        ) : (
          <ul className="space-y-2">
            {convos.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/apps/messagerie/${c.id}`}
                  className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 transition hover:bg-slate-800/60 active:bg-slate-800"
                >
                  <div
                    className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-fuchsia-500/20 text-lg font-semibold text-fuchsia-200"
                    aria-hidden="true"
                  >
                    {(c.title || conversationDisplayName(c, user.id))
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">
                        {conversationDisplayName(c, user.id)}
                      </p>
                      <span className="flex-shrink-0 text-xs text-slate-400">
                        {formatTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-slate-400">
                        {c.lastMessage
                          ? `${
                              c.lastMessage.authorId === user.id
                                ? 'Toi'
                                : c.lastMessage.authorFirstName || '—'
                            } : ${c.lastMessage.body}`
                          : 'Aucun message'}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="flex-shrink-0 rounded-full bg-fuchsia-500 px-2 py-0.5 text-xs font-bold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
