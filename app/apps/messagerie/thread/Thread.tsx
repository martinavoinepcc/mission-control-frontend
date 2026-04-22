'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';
import { getStoredUser, type User as MeUser } from '@/lib/api';
import {
  getConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  conversationDisplayName,
  avatarColor,
  avatarInitial,
  formatDateSeparator,
  isSameCalendarDay,
  type ConversationDetails,
  type Message,
} from '@/lib/messagerie-api';

const POLL_INTERVAL_MS = 5000;

// --- Small presentational pieces ---

function Avatar({
  userId,
  firstName,
  size = 36,
  ring = false,
}: {
  userId: number;
  firstName: string | null;
  size?: number;
  ring?: boolean;
}) {
  const c = avatarColor(userId);
  return (
    <div
      className={`${c.bg} text-white rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${
        ring ? 'ring-2 ring-slate-900' : ''
      }`}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.floor(size / 2.4)) }}
      aria-label={firstName || 'Membre'}
      title={firstName || ''}
    >
      {avatarInitial(firstName)}
    </div>
  );
}

function StackedAvatars({
  members,
  currentUserId,
  max = 3,
}: {
  members: Array<{ id: number; firstName: string }>;
  currentUserId: number;
  max?: number;
}) {
  const others = members.filter((m) => m.id !== currentUserId);
  if (others.length === 0) return null;
  const shown = others.slice(0, max);
  const rest = others.length - shown.length;
  return (
    <div className="flex -space-x-2 flex-shrink-0">
      {shown.map((m) => (
        <Avatar key={m.id} userId={m.id} firstName={m.firstName} size={32} ring />
      ))}
      {rest > 0 && (
        <div className="h-8 w-8 rounded-full bg-slate-700 text-white text-[11px] flex items-center justify-center ring-2 ring-slate-900">
          +{rest}
        </div>
      )}
    </div>
  );
}

function DateSeparator({ iso }: { iso: string }) {
  return (
    <li className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] uppercase tracking-wider text-slate-400">
        {formatDateSeparator(iso)}
      </span>
    </li>
  );
}

// --- Main component ---

export default function Thread() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idStr = searchParams?.get('id') || '';
  const conversationId = Number.parseInt(idStr, 10);
  const validId = Number.isFinite(conversationId) && conversationId > 0;

  const [user, setUser] = useState<MeUser | null>(null);
  const [convo, setConvo] = useState<ConversationDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const loadMessages = useCallback(async () => {
    if (!validId) return;
    try {
      const { messages: fresh } = await listMessages(conversationId, { limit: 100 });
      setMessages((prev) => {
        const prevLast = prev.length ? prev[prev.length - 1].id : 0;
        const freshLast = fresh.length ? fresh[fresh.length - 1].id : 0;
        if (prevLast === freshLast && prev.length === fresh.length) return prev;
        return fresh;
      });
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    }
  }, [conversationId, validId]);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      router.push('/');
      return;
    }
    setUser(u);

    if (!validId) {
      setLoadingInitial(false);
      return;
    }
    (async () => {
      try {
        const c = await getConversation(conversationId);
        setConvo(c);
        await loadMessages();
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement');
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [conversationId, validId, loadMessages, router]);

  useEffect(() => {
    if (!loadingInitial && validId) {
      markConversationRead(conversationId).catch(() => {});
      window.setTimeout(() => scrollToBottom('auto'), 60);
    }
  }, [loadingInitial, conversationId, validId, scrollToBottom]);

  useEffect(() => {
    if (!validId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages();
    }, POLL_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        loadMessages();
        markConversationRead(conversationId).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loadMessages, conversationId, validId]);

  useEffect(() => {
    if (!messages.length) return;
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < 200) window.setTimeout(() => scrollToBottom('smooth'), 30);
  }, [messages.length, scrollToBottom]);

  // Auto-grow textarea (jusqu'à ~5 lignes)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [draft]);

  async function onSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const body = draft.trim();
    if (!body || sending || !validId) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage(conversationId, body);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      window.setTimeout(() => scrollToBottom('smooth'), 30);
    } catch (e: any) {
      setError(e?.message || "Erreur d'envoi");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  const participantsList = useMemo(() => {
    if (!convo) return [];
    return convo.participants.map((p) => ({ id: p.id, firstName: p.firstName }));
  }, [convo]);

  if (!user) return null;

  if (!validId) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-300">
        <p className="mb-4">Conversation invalide.</p>
        <button
          onClick={() => router.push('/apps/messagerie')}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          ← Conversations
        </button>
      </main>
    );
  }

  const headerTitle = convo ? conversationDisplayName(convo, user.id) : 'Conversation';
  const headerSub = convo
    ? convo.participants
        .filter((p) => p.id !== user.id)
        .map((p) => p.firstName)
        .join(' · ') || 'Personne d\'autre pour le moment'
    : '';

  return (
    <main className="flex flex-col h-[100dvh] bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* HEADER — safe-area top, bouton back bien visible sous la dynamic island */}
      <header
        className="border-b border-white/5 bg-slate-950/90 backdrop-blur-md"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-3 px-3 pb-3 sm:px-4">
          <button
            onClick={() => router.push('/apps/messagerie')}
            aria-label="Retour aux conversations"
            className="h-11 w-11 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
          >
            <FontAwesomeIcon icon={UI.back} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">{headerTitle}</h1>
            <p className="truncate text-xs text-slate-400">{headerSub}</p>
          </div>
          <StackedAvatars members={participantsList} currentUserId={user.id} max={3} />
        </div>
      </header>

      {/* SCROLLING MESSAGES AREA */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4"
        style={{ WebkitOverflowScrolling: 'touch' as any }}
      >
        {loadingInitial ? (
          <div className="text-center text-sm text-slate-400">Chargement…</div>
        ) : messages.length === 0 ? (
          <div className="mt-10 text-center text-sm text-slate-400">
            <p>Aucun message encore.</p>
            <p className="mt-1 text-slate-500">Écris le premier ci-dessous.</p>
          </div>
        ) : (
          <ol className="space-y-0.5">
            {messages.map((m, i) => {
              const mine = m.authorId === user.id;
              const prev = i > 0 ? messages[i - 1] : null;
              const next = i < messages.length - 1 ? messages[i + 1] : null;

              const showDateSep = !prev || !isSameCalendarDay(prev.createdAt, m.createdAt);
              const firstOfGroup = !prev || prev.authorId !== m.authorId || !isSameCalendarDay(prev.createdAt, m.createdAt);
              const lastOfGroup = !next || next.authorId !== m.authorId || !isSameCalendarDay(next.createdAt, m.createdAt);

              return (
                <div key={m.id}>
                  {showDateSep && <DateSeparator iso={m.createdAt} />}
                  <li
                    className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${
                      firstOfGroup ? 'mt-2' : 'mt-0.5'
                    }`}
                  >
                    {!mine && (
                      <div className="w-9 flex-shrink-0">
                        {lastOfGroup ? (
                          <Avatar userId={m.authorId} firstName={m.authorFirstName} size={32} />
                        ) : null}
                      </div>
                    )}
                    <div className={`max-w-[78%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      {firstOfGroup && !mine && (
                        <span className="mb-0.5 px-1 text-[11px] text-slate-400">
                          {m.authorFirstName}
                        </span>
                      )}
                      <div
                        className={`px-3.5 py-2 text-[15px] leading-snug ${
                          mine
                            ? 'bg-fuchsia-500 text-white'
                            : 'bg-slate-800 text-slate-100'
                        }`}
                        style={{
                          wordBreak: 'break-word',
                          borderRadius: 18,
                          borderBottomRightRadius: mine && lastOfGroup ? 6 : 18,
                          borderBottomLeftRadius: !mine && lastOfGroup ? 6 : 18,
                        }}
                      >
                        {m.body}
                      </div>
                    </div>
                  </li>
                </div>
              );
            })}
          </ol>
        )}
      </div>

      {error && (
        <div className="border-t border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* INPUT — safe-area bottom, bouton send collé au textarea */}
      <form
        onSubmit={onSend}
        className="flex items-end gap-2 border-t border-white/5 bg-slate-950/95 px-3 py-2 sm:px-4"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-1 items-end gap-2 rounded-3xl border border-white/10 bg-slate-900 pl-4 pr-2 py-1 focus-within:border-fuchsia-500/60">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Écris un message…"
            rows={1}
            className="flex-1 resize-none bg-transparent py-2 text-[16px] text-white placeholder:text-slate-500 focus:outline-none"
            style={{ maxHeight: 140 }}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            aria-label="Envoyer"
            className="my-1 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-fuchsia-500 text-white transition hover:bg-fuchsia-400 disabled:opacity-30"
          >
            <FontAwesomeIcon icon={UI.send} className="text-sm" />
          </button>
        </div>
      </form>
    </main>
  );
}
