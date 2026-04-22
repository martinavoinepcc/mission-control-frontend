'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';
import { getStoredUser, listPickableUsers, type User as MeUser, type PickableUser } from '@/lib/api';
import {
  listConversations,
  createConversation,
  conversationDisplayName,
  formatTime,
  participantAvatarSrc,
  type ConversationSummary,
  type MsgAuthor,
} from '@/lib/messagerie-api';
import Avatar from '@/components/Avatar';
import PushBanner from '@/components/push/PushBanner';
import { setAppBadge } from '@/lib/app-badge';

// --- Stack d'avatars (photo si dispo, sinon couleur+initiale) ---
function StackedAvatars({
  members,
  currentUserId,
  max = 3,
  size = 36,
  ringColor = '#0f172a',
}: {
  members: MsgAuthor[];
  currentUserId: number;
  max?: number;
  size?: number;
  ringColor?: string;
}) {
  const others = members.filter((m) => m.id !== currentUserId);
  if (others.length === 0) return null;
  const shown = others.slice(0, max);
  const rest = others.length - shown.length;
  return (
    <div className="flex -space-x-2 flex-shrink-0">
      {shown.map((m) => (
        <Avatar
          key={m.id}
          userId={m.id}
          firstName={m.firstName}
          src={participantAvatarSrc(m)}
          size={size}
          ring
          ringColor={ringColor}
        />
      ))}
      {rest > 0 && (
        <div
          className="rounded-full bg-slate-700 text-white text-[11px] flex items-center justify-center"
          style={{
            width: size,
            height: size,
            boxShadow: `0 0 0 2px ${ringColor}`,
          }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

// --- Modal "Nouvelle conversation" ---
function NewConversationModal({
  open,
  onClose,
  onCreated,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (newId: number) => void;
  currentUserId: number;
}) {
  const [users, setUsers] = useState<PickableUser[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setTitle('');
    setError(null);
    (async () => {
      try {
        const data = await listPickableUsers();
        setUsers(data.users.filter((u) => u.id !== currentUserId));
      } catch (e: any) {
        setError(e?.message || 'Erreur');
      }
    })();
  }, [open, currentUserId]);

  if (!open) return null;

  const canCreate = selected.size > 0 && !loading;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!canCreate) return;
    setLoading(true);
    setError(null);
    try {
      const ids = Array.from(selected);
      const cleanTitle = title.trim();
      const created = await createConversation({
        title: selected.size >= 2 ? cleanTitle || undefined : undefined, // DM sans titre
        participantIds: ids,
      });
      onCreated(created.id);
    } catch (e: any) {
      setError(e?.message || "Erreur à la création");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur">
      <div
        className="relative w-full sm:max-w-lg bg-slate-900 text-slate-100 sm:rounded-2xl border border-white/10 shadow-2xl"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          maxHeight: '90dvh',
          overflow: 'auto',
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/5 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-sky-300">Nouvelle conversation</p>
            <h2 className="text-base font-bold">Choisis des membres</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="h-10 w-10 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center"
          >
            <FontAwesomeIcon icon={UI.close} />
          </button>
        </div>

        <div className="px-4 py-3">
          {error && (
            <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </p>
          )}

          {users.length === 0 ? (
            <p className="text-sm text-slate-400">
              Aucun autre membre n&apos;a encore accès à la messagerie. Demande à l&apos;admin de
              donner l&apos;accès depuis le panel d&apos;administration.
            </p>
          ) : (
            <>
              <ul className="mt-1 space-y-1">
                {users.map((u) => {
                  const sel = selected.has(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => toggle(u.id)}
                        className={`w-full flex items-center gap-3 rounded-xl border p-2 text-left transition ${
                          sel
                            ? 'border-sky-400 bg-sky-500/10'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                        }`}
                      >
                        <Avatar
                          userId={u.id}
                          firstName={u.firstName}
                          src={u.avatarData}
                          size={40}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{u.firstName}</p>
                          {u.username && (
                            <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                          )}
                        </div>
                        <div
                          className={`h-6 w-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                            sel ? 'border-sky-400 bg-sky-500 text-white' : 'border-slate-600'
                          }`}
                        >
                          {sel && <FontAwesomeIcon icon={UI.checkMark} className="text-[10px]" />}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selected.size >= 2 && (
                <div className="mt-4">
                  <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                    Titre du groupe (facultatif)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ex. Famille, Équipe hockey, …"
                    maxLength={60}
                    className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-[16px] text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-white/5 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!canCreate}
            className="flex-1 rounded-xl bg-sky-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
          >
            {loading ? 'Création…' : selected.size <= 1 ? 'Créer la discussion' : 'Créer le groupe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Page principale ---
export default function MessagerieList() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [convos, setConvos] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listConversations();
      setConvos(list);
      setError(null);
      const total = list.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      setAppBadge(total); // resync pastille à chaque poll
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
            <p className="text-[10px] uppercase tracking-[0.18em] text-sky-300">Messagerie</p>
            <h1 className="text-lg sm:text-xl font-bold truncate">Conversations</h1>
          </div>
          <button
            onClick={() => setShowNew(true)}
            aria-label="Nouvelle conversation"
            className="h-11 w-11 rounded-xl bg-sky-500 text-white hover:bg-sky-400 transition flex items-center justify-center flex-shrink-0"
            title="Nouvelle conversation"
          >
            <FontAwesomeIcon icon={UI.plus} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4">
        <PushBanner />

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
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
            <p className="mb-2">Aucune conversation pour l&apos;instant.</p>
            <button
              onClick={() => setShowNew(true)}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
            >
              Commencer une conversation
            </button>
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
                    className="group flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 transition hover:border-sky-500/30 hover:bg-slate-800/70 active:bg-slate-800"
                  >
                    <StackedAvatars members={c.participants} currentUserId={user.id} size={44} />
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
                                lastAuthorMine ? 'Toi' : c.lastMessage.authorFirstName || '—'
                              } : ${c.lastMessage.body || '📷 photo'}`
                            : 'Commencer la conversation…'}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-bold text-white">
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

      <NewConversationModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={(id) => {
          setShowNew(false);
          router.push(`/apps/messagerie/thread/?id=${id}`);
        }}
        currentUserId={user.id}
      />
    </main>
  );
}
