'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';
import { getStoredUser, type User as MeUser } from '@/lib/api';
import {
  getConversation,
  listMessages,
  sendMessage,
  markConversationRead,
  conversationDisplayName,
  formatTime,
  type ConversationDetails,
  type Message,
} from '@/lib/messagerie-api';

const POLL_INTERVAL_MS = 5000;

export default function Thread({ conversationId }: { conversationId: number }) {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [convo, setConvo] = useState<ConversationDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<number>(0);
  const userRef = useRef<MeUser | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const { messages: fresh } = await listMessages(conversationId, { limit: 100 });
      setMessages((prev) => {
        const prevLastId = prev.length ? prev[prev.length - 1].id : 0;
        const freshLastId = fresh.length ? fresh[fresh.length - 1].id : 0;
        if (prevLastId === freshLastId && prev.length === fresh.length) return prev;
        lastIdRef.current = freshLastId;
        return fresh;
      });
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    }
  }, [conversationId]);

  // Initial load
  useEffect(() => {
    const u = getStoredUser();
    if (!u) {
      router.push('/');
      return;
    }
    setUser(u);
    userRef.current = u;

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
  }, [conversationId, loadMessages, router]);

  // Mark as read + scroll to bottom on mount
  useEffect(() => {
    if (!loadingInitial) {
      markConversationRead(conversationId).catch(() => {});
      // slight delay to let the DOM render
      window.setTimeout(() => scrollToBottom('auto'), 60);
    }
  }, [loadingInitial, conversationId, scrollToBottom]);

  // Poll for new messages when visible + when focused
  useEffect(() => {
    let timer: number | null = null;
    const tick = () => {
      if (document.visibilityState === 'visible') loadMessages();
    };
    timer = window.setInterval(tick, POLL_INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        loadMessages();
        markConversationRead(conversationId).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loadMessages, conversationId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (!messages.length) return;
    const el = scrollerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Only auto-scroll if user is near the bottom already (don't yank them up when reading old msgs)
    if (distanceFromBottom < 200) {
      window.setTimeout(() => scrollToBottom('smooth'), 30);
    }
  }, [messages.length, scrollToBottom]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage(conversationId, body);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      lastIdRef.current = msg.id;
      window.setTimeout(() => scrollToBottom('smooth'), 30);
    } catch (e: any) {
      setError(e?.message || "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  }

  if (!user) return null;

  const headerTitle = convo
    ? conversationDisplayName(convo, user.id)
    : 'Conversation';

  return (
    <main className="flex flex-col h-[100dvh] bg-slate-950 text-slate-100 overflow-x-hidden">
      <header className="flex items-center gap-3 border-b border-white/5 bg-slate-950/90 px-3 py-3 backdrop-blur-sm sm:px-4">
        <button
          onClick={() => router.push('/apps/messagerie')}
          aria-label="Retour aux conversations"
          className="w-11 h-11 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition flex items-center justify-center flex-shrink-0"
        >
          <FontAwesomeIcon icon={UI.back} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-fuchsia-300">Messagerie</p>
          <h1 className="truncate text-base font-semibold sm:text-lg">{headerTitle}</h1>
          {convo && (
            <p className="truncate text-xs text-slate-400">
              {convo.participants.length} participant{convo.participants.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4"
        style={{ WebkitOverflowScrolling: 'touch' as any }}
      >
        {loadingInitial ? (
          <div className="text-center text-sm text-slate-400">Chargement…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-slate-400">Aucun message encore.</div>
        ) : (
          <ol className="space-y-2">
            {messages.map((m, i) => {
              const mine = m.authorId === user.id;
              const prev = i > 0 ? messages[i - 1] : null;
              const showAuthor = !mine && (!prev || prev.authorId !== m.authorId);
              return (
                <li
                  key={m.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {showAuthor && (
                      <span className="mb-0.5 text-[11px] text-fuchsia-300/80">
                        {m.authorFirstName}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                        mine
                          ? 'rounded-br-md bg-fuchsia-500 text-white'
                          : 'rounded-bl-md bg-slate-800 text-slate-100'
                      }`}
                      style={{ wordBreak: 'break-word' }}
                    >
                      {m.body}
                    </div>
                    <span className="mt-0.5 text-[11px] text-slate-500">{formatTime(m.createdAt)}</span>
                  </div>
                </li>
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

      <form
        onSubmit={onSend}
        className="flex items-end gap-2 border-t border-white/5 bg-slate-950/95 px-3 py-2 sm:px-4"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Écris un message…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-white/10 bg-slate-900 px-4 py-2.5 text-[16px] text-white placeholder:text-slate-500 focus:border-fuchsia-500/60 focus:outline-none"
          style={{ maxHeight: '140px' }}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Envoyer"
          className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-fuchsia-500 text-white transition hover:bg-fuchsia-400 disabled:opacity-40"
        >
          <FontAwesomeIcon icon={UI.send} />
        </button>
      </form>
    </main>
  );
}
