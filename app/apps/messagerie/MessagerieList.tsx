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
  avatarColor,
  avatarInitial,
  type ConversationSummary,
  type MsgAuthor,
} from '@/lib/messagerie-api';

function StackedAvatars({
  members,
  currentUserId,
  max = 3,
}: {
  members: MsgAuthor[];
  currentUserId: number;
  max?: number;
}) {
  const others = members.filter((m) => m.id !== currentUserId);
  if (others.length === 0) return null;
  const shown = others.slice(0, max);
  const rest = others.length - shown.length;

  return (
    <div className="flex -space-x-2 flex-shrink-0">
      {shown.map((m) => {
        const c = avatarColor(m.id);
        return (
          <div
            key={m.id}
            className={`h-11 w-11 rounded-full flex items-center justify-center font-semibold text-white ring-2 ring-slate-900 ${c.bg}`}
            title={m.firstName}
            aria-label={m.firstName}
          >
            {avatarInitial(m.firstName)}
          </div>
        );
      })}
      {rest > 0 && (
        <div className="h-11 w-11 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center ring-2 ring-slate-900">
          +{rest}
        </div>
      )}
    </div>
  );
}

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
      <div
        className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/85 backdrop-blur-md"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-3 pb-3 sm:px-4">
          <button
            onClick={() => router.push('/dashboard')}
            aria-label="Retour au dashboard"
            className="h-11 w-11 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          >
            <FontAwesomeIcon icon={UI.back} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-300">Messagerie</p>
            <h1 className="text-lg sm:text-xl font-bold truncate">Conversations</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4">
        {error && (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
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
            {convos.map((c) => {
              const displayName = conversationDisplayName(c, user.id);
              const lastAuthorMine = c.lastMessage && c.lastMessage.authorId === user.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/apps/messagerie/thread/?id=${c.id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 transition hover:border-fuchsia-500/30 hover:bg-slate-800/70 active:bg-slate-800"
                  >
                    <StackedAvatars members={c.participants} currentUserId={user.id} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-slate-100">{displayName}</p>
                        <span className="flex-shrink-0 text-xs text-slate-400">
                          {formatTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-sm ${
                            c.unreadCount > 0 && !lastAuthorMine
                              ? 'text-slate-100 font-medium'
                              : 'text-slate-400'
                          }`}
                        >
                          {c.lastMessage
                            ? `${
                                lastAuthorMine
                                  ? 'Toi'
                                  : c.lastMessage.authorFirstName || '—'
                              } : ${c.lastMessage.body}`
                            : 'Commencer la conversation…'}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-fuchsia-500 px-2 py-0.5 text-[11px] font-bold text-white">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
