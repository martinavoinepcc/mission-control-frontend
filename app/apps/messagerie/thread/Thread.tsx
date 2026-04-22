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
  formatDateSeparator,
  isSameCalendarDay,
  participantAvatarSrc,
  type ConversationDetails,
  type Message,
  type MsgAuthor,
} from '@/lib/messagerie-api';
import Avatar from '@/components/Avatar';
import { compressImage, humanBytes } from '@/lib/image-utils';

const POLL_INTERVAL_MS = 5000;

// --- Presentational helpers ---

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
      {shown.map((m) => (
        <Avatar
          key={m.id}
          userId={m.id}
          firstName={m.firstName}
          src={participantAvatarSrc(m)}
          size={32}
          ring
        />
      ))}
      {rest > 0 && (
        <div
          className="h-8 w-8 rounded-full bg-slate-700 text-white text-[11px] flex items-center justify-center"
          style={{ boxShadow: '0 0 0 2px #0f172a' }}
        >
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

// --- Main ---

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

  // Image attachment state
  const [attachPreview, setAttachPreview] = useState<{
    dataUrl: string;
    width: number;
    height: number;
    bytes: number;
  } | null>(null);
  const [attaching, setAttaching] = useState(false);

  // Lightbox (tap image to zoom)
  const [lightbox, setLightbox] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (distance < 250) window.setTimeout(() => scrollToBottom('smooth'), 30);
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [draft]);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      setError('Fichier non supporté (image requise).');
      return;
    }
    setAttaching(true);
    setError(null);
    try {
      const c = await compressImage(file, { maxDim: 1600, maxBytes: 600 * 1024 });
      setAttachPreview({ dataUrl: c.dataUrl, width: c.width, height: c.height, bytes: c.bytes });
    } catch (err: any) {
      setError(err?.message || 'Erreur de compression');
    } finally {
      setAttaching(false);
    }
  }

  async function onSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const body = draft.trim();
    if (!validId || sending) return;
    if (!body && !attachPreview) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage(
        conversationId,
        body,
        attachPreview
          ? {
              data: attachPreview.dataUrl,
              width: attachPreview.width,
              height: attachPreview.height,
            }
          : undefined
      );
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      setAttachPreview(null);
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
    return convo.participants;
  }, [convo]);

  const authorMap = useMemo(() => {
    const m: Record<number, { firstName: string; hasAvatar?: boolean; avatarUpdatedAt?: string | null }> = {};
    (convo?.participants || []).forEach((p) => {
      m[p.id] = { firstName: p.firstName, hasAvatar: p.hasAvatar, avatarUpdatedAt: p.avatarUpdatedAt };
    });
    return m;
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
        .join(' · ') || "Personne d'autre pour le moment"
    : '';

  return (
    <main className="flex flex-col h-[100dvh] bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* HEADER */}
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

      {/* MESSAGES */}
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
              const firstOfGroup =
                !prev || prev.authorId !== m.authorId || !isSameCalendarDay(prev.createdAt, m.createdAt);
              const lastOfGroup =
                !next || next.authorId !== m.authorId || !isSameCalendarDay(next.createdAt, m.createdAt);

              const authorInfo = authorMap[m.authorId] || { firstName: m.authorFirstName || '' };

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
                          <Avatar
                            userId={m.authorId}
                            firstName={m.authorFirstName}
                            src={participantAvatarSrc({
                              id: m.authorId,
                              firstName: m.authorFirstName || '',
                              hasAvatar: authorInfo.hasAvatar,
                              avatarUpdatedAt: authorInfo.avatarUpdatedAt || null,
                            })}
                            size={32}
                          />
                        ) : null}
                      </div>
                    )}
                    <div className={`max-w-[78%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      {firstOfGroup && !mine && (
                        <span className="mb-0.5 px-1 text-[11px] text-slate-400">
                          {m.authorFirstName}
                        </span>
                      )}
                      {m.imageData && (
                        <button
                          type="button"
                          onClick={() => setLightbox(m.imageData!)}
                          className={`mb-1 max-w-full overflow-hidden rounded-2xl ${
                            mine ? 'self-end' : 'self-start'
                          }`}
                          aria-label="Voir l'image"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.imageData}
                            alt=""
                            width={m.imageWidth || undefined}
                            height={m.imageHeight || undefined}
                            style={{
                              maxHeight: 360,
                              maxWidth: '100%',
                              width: 'auto',
                              height: 'auto',
                              display: 'block',
                            }}
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      )}
                      {m.body && (
                        <div
                          className={`px-3.5 py-2 text-[15px] leading-snug ${
                            mine ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-100'
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
                      )}
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

      {/* Preview image avant envoi */}
      {attachPreview && (
        <div className="border-t border-white/5 bg-slate-900/60 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachPreview.dataUrl}
              alt="Aperçu"
              className="h-16 w-16 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1 text-xs text-slate-300">
              <p className="truncate">
                Image prête à envoyer — {humanBytes(attachPreview.bytes)}
              </p>
              <p className="text-slate-500">{attachPreview.width}×{attachPreview.height}</p>
            </div>
            <button
              onClick={() => setAttachPreview(null)}
              className="h-8 w-8 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center"
              aria-label="Retirer"
            >
              <FontAwesomeIcon icon={UI.close} className="text-xs" />
            </button>
          </div>
        </div>
      )}

      {/* INPUT */}
      <form
        onSubmit={onSend}
        className="flex items-end gap-2 border-t border-white/5 bg-slate-950/95 px-3 py-2 sm:px-4"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={attaching || sending}
          aria-label="Joindre une image"
          className="h-11 w-11 flex-shrink-0 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center disabled:opacity-50"
        >
          <FontAwesomeIcon icon={UI.plus} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />
        <div className="flex flex-1 items-end gap-2 rounded-3xl border border-white/10 bg-slate-900 pl-4 pr-2 py-1 focus-within:border-sky-500/60">
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
            placeholder={attachPreview ? "Ajoute un message (optionnel)…" : "Écris un message…"}
            rows={1}
            className="flex-1 resize-none bg-transparent py-2 text-[16px] text-white placeholder:text-slate-500 focus:outline-none"
            style={{ maxHeight: 140 }}
          />
          <button
            type="submit"
            disabled={sending || attaching || (!draft.trim() && !attachPreview)}
            aria-label="Envoyer"
            className="my-1 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-sky-500 text-white transition hover:bg-sky-400 disabled:opacity-30"
          >
            <FontAwesomeIcon icon={UI.send} className="text-sm" />
          </button>
        </div>
      </form>

      {/* Lightbox (image plein écran) */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            aria-label="Fermer"
            className="absolute top-4 right-4 h-11 w-11 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center"
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
          >
            <FontAwesomeIcon icon={UI.close} />
          </button>
        </div>
      )}
    </main>
  );
}
