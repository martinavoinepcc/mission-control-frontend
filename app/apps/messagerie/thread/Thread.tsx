'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UI } from '@/lib/icons';
import { getStoredUser, type User as MeUser } from '@/lib/api';
import {
  getConversation,
  listMessages,
  listConversations,
  sendMessage,
  markConversationRead,
  deleteConversation,
  conversationDisplayName,
  formatTime,
  formatDateSeparator,
  isSameCalendarDay,
  participantAvatarSrc,
  toggleReaction,
  messageImageUrl,
  messageAudioUrl,
  REACTION_EMOJIS,
  type ConversationDetails,
  type Message,
  type MsgAuthor,
  type MessageReaction,
  type MessageReplyPreview,
} from '@/lib/messagerie-api';
import Avatar from '@/components/Avatar';
import { compressImage, humanBytes } from '@/lib/image-utils';
import { setAppBadge } from '@/lib/app-badge';

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

// ----- Markdown light pour les messages -----
// Supporte : **gras**, *italique*, ~~barre~~, `code`, retours a la ligne.
// Escape HTML d'abord pour que le user ne puisse pas injecter de balises.
function renderMessageBody(text: string): string {
  if (!text) return '';
  let h = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Code inline en premier (pour pas parser le markdown a l'interieur)
  h = h.replace(/`([^`\n]+)`/g, '<code class="msg-code">$1</code>');
  // Bold avant italique (sinon le ** est mange par italic)
  h = h.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // Italique (single *)
  h = h.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  // Strikethrough
  h = h.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  // Newlines
  h = h.replace(/\n/g, '<br>');
  return h;
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

  // Audio attachment state (mp3, m4a, wav, etc.)
  const [audioAttach, setAudioAttach] = useState<{
    dataUrl: string;
    type: string;
    name: string;
    bytes: number;
  } | null>(null);

  // Reply state : si set, le prochain envoi sera une reponse a ce message
  const [replyingTo, setReplyingTo] = useState<MessageReplyPreview | null>(null);

  // Active message menu (pour Copy / React / Reply). messageId ou null.
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [showReactPicker, setShowReactPicker] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<number | null>(null);

  // Lightbox (tap image to zoom). On stocke {url, downloadUrl} pour pouvoir telecharger.
  const [lightbox, setLightbox] = useState<{ url: string; downloadUrl: string } | null>(null);

  // Menu ••• (delete)
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      markConversationRead(conversationId)
        .then(async () => {
          // Recalcule le total non-lus pour mettre à jour la pastille iPhone
          try {
            const all = await listConversations();
            const total = all.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
            setAppBadge(total);
          } catch {
            /* silencieux */
          }
        })
        .catch(() => {});
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

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setError(null);
    // Audio (mp3, m4a, wav, webm, ogg, etc.)
    if (file.type.startsWith('audio/')) {
      // Limite cote client : ~5 MB raw (avant base64). Cap a 5*1024*1024 pour matcher le backend (~6.7MB base64).
      if (file.size > 5 * 1024 * 1024) {
        setError(`Audio trop volumineux (${humanBytes(file.size)}). Max 5 MB.`);
        return;
      }
      setAttaching(true);
      try {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error('Lecture du fichier echouee'));
          r.readAsDataURL(file);
        });
        setAudioAttach({
          dataUrl,
          type: file.type || 'audio/mpeg',
          name: file.name || 'audio.mp3',
          bytes: file.size,
        });
      } catch (err: any) {
        setError(err?.message || 'Erreur lecture audio');
      } finally {
        setAttaching(false);
      }
      return;
    }
    // Image (compresse pour reduire la taille)
    if (file.type.startsWith('image/')) {
      setAttaching(true);
      try {
        const c = await compressImage(file, { maxDim: 1600, maxBytes: 600 * 1024 });
        setAttachPreview({ dataUrl: c.dataUrl, width: c.width, height: c.height, bytes: c.bytes });
      } catch (err: any) {
        setError(err?.message || 'Erreur de compression');
      } finally {
        setAttaching(false);
      }
      return;
    }
    setError('Fichier non supporte (image ou audio uniquement).');
  }

  // Copy texte du message (ou indication si pas de body)
  async function handleCopy(m: Message) {
    const txt = m.body || '(sans texte)';
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      // Fallback pour vieux navigateurs
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopyFeedback(m.id);
    setActiveMenu(null);
    setTimeout(() => setCopyFeedback((cur) => (cur === m.id ? null : cur)), 1400);
  }

  // Set le contexte de reply : le composer affiche un bandeau et le prochain envoi inclut replyToId
  function handleReply(m: Message) {
    setReplyingTo({
      id: m.id,
      body: m.body || '',
      authorId: m.authorId,
      authorFirstName: m.authorFirstName,
      hasImage: !!m.hasImage,
      hasAudio: !!m.hasAudio,
      audioName: m.audioName || null,
    });
    setActiveMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  // Toggle reaction sur un message + update local
  async function handleReact(messageId: number, emoji: string) {
    setShowReactPicker(null);
    setActiveMenu(null);
    try {
      const result = await toggleReaction(conversationId, messageId, emoji);
      setMessages((prev) => prev.map((mm) => (mm.id === messageId ? { ...mm, reactions: result.reactions } : mm)));
    } catch (e: any) {
      setError(e?.message || 'Erreur reaction');
    }
  }

  // Toolbar formatage : wrap la selection avec un marker (ou insere les 2 markers autour du curseur)
  function insertWrap(marker: string, placeholder = 'texte') {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    const before = draft.slice(0, start);
    const sel = draft.slice(start, end);
    const after = draft.slice(end);
    const inner = sel || placeholder;
    const newText = before + marker + inner + marker + after;
    setDraft(newText);
    setTimeout(() => {
      ta.focus();
      // Place caret au milieu (sans selection) ou apres le wrap (avec selection)
      const innerStart = start + marker.length;
      const innerEnd = innerStart + inner.length;
      ta.setSelectionRange(innerStart, innerEnd);
    }, 0);
  }

  async function onSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const body = draft.trim();
    if (!validId || sending) return;
    if (!body && !attachPreview && !audioAttach) return;
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
          : undefined,
        audioAttach
          ? {
              data: audioAttach.dataUrl,
              type: audioAttach.type,
              name: audioAttach.name,
            }
          : undefined,
        replyingTo ? replyingTo.id : null
      );
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      setAttachPreview(null);
      setAudioAttach(null);
      setReplyingTo(null);
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

          {/* Menu ••• pour actions convo */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Options de la conversation"
              className="h-11 w-11 rounded-xl border border-white/15 text-white/80 hover:bg-white/5 transition flex items-center justify-center"
            >
              <span className="text-xl leading-none">⋯</span>
            </button>
            {menuOpen && (
              <>
                {/* backdrop pour fermer */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-rose-300 hover:bg-rose-500/10"
                  >
                    <FontAwesomeIcon icon={UI.trash} className="text-xs" />
                    Supprimer la conversation
                  </button>
                </div>
              </>
            )}
          </div>
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
                    <div className={`max-w-[78%] flex flex-col ${mine ? 'items-end' : 'items-start'} group/msg relative`}>
                      {firstOfGroup && !mine && (
                        <span className="mb-0.5 px-1 text-[11px] text-slate-400">
                          {m.authorFirstName}
                        </span>
                      )}
                      {/* Bouton actions message (Copy / Reply / React) — visible au hover desktop, tap pour ouvrir mobile */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === m.id ? null : m.id); setShowReactPicker(null); }}
                        aria-label="Actions message"
                        className={`absolute -top-2 ${mine ? '-left-7' : '-right-7'} h-7 w-7 rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 transition flex items-center justify-center text-sm opacity-0 group-hover/msg:opacity-100 focus:opacity-100 z-10`}
                      >
                        ⋯
                      </button>
                      {activeMenu === m.id && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => { setActiveMenu(null); setShowReactPicker(null); }} aria-hidden="true" />
                          <div
                            className={`absolute -top-10 ${mine ? 'right-0' : 'left-0'} z-30 flex gap-1 rounded-xl border border-white/10 bg-slate-900 p-1 shadow-2xl`}
                          >
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleCopy(m); }} title="Copier" className="h-8 w-8 rounded-md text-slate-300 hover:bg-white/10 flex items-center justify-center text-sm">
                              {copyFeedback === m.id ? '✓' : '⧉'}
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleReply(m); }} title="Repondre" className="h-8 w-8 rounded-md text-slate-300 hover:bg-white/10 flex items-center justify-center text-sm">
                              ↩
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setShowReactPicker(showReactPicker === m.id ? null : m.id); }} title="Reagir" className="h-8 w-8 rounded-md text-slate-300 hover:bg-white/10 flex items-center justify-center text-sm">
                              😊
                            </button>
                          </div>
                          {showReactPicker === m.id && (
                            <div
                              className={`absolute -top-20 ${mine ? 'right-0' : 'left-0'} z-30 flex gap-0.5 rounded-full border border-white/10 bg-slate-900 px-2 py-1 shadow-2xl`}
                            >
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleReact(m.id, emoji); }}
                                  className="h-9 w-9 rounded-full text-xl hover:bg-white/10 transition flex items-center justify-center"
                                  aria-label={`Reagir ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {/* Reply preview (citation du message original au-dessus de la bulle) */}
                      {m.replyTo && (
                        <div
                          className={`mb-0.5 max-w-full rounded-lg border-l-2 px-2.5 py-1 text-[12px] ${
                            mine ? 'border-sky-300/70 bg-sky-500/10 text-sky-100' : 'border-slate-500 bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <div className="font-semibold opacity-80">↩ {m.replyTo.authorFirstName || 'Quelqu\'un'}</div>
                          <div className="truncate opacity-90">
                            {m.replyTo.hasAudio ? '🎵 ' : ''}
                            {m.replyTo.hasImage ? '📷 ' : ''}
                            {m.replyTo.body
                              ? (m.replyTo.body.length > 100 ? m.replyTo.body.slice(0, 97) + '…' : m.replyTo.body)
                              : (m.replyTo.hasAudio ? (m.replyTo.audioName || 'Audio') : (m.replyTo.hasImage ? 'Photo' : '...'))}
                          </div>
                        </div>
                      )}
                      {m.hasImage && (
                        <div className={`mb-1 flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                          <button
                            type="button"
                            onClick={() => setLightbox({
                              url: messageImageUrl(conversationId, m.id),
                              downloadUrl: messageImageUrl(conversationId, m.id, { download: true }),
                            })}
                            className="max-w-full overflow-hidden rounded-2xl"
                            aria-label="Voir l'image"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={messageImageUrl(conversationId, m.id)}
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
                          <a
                            href={messageImageUrl(conversationId, m.id, { download: true })}
                            download={`image-${m.id}.webp`}
                            className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2"
                          >
                            ⬇ Télécharger l'image
                          </a>
                        </div>
                      )}
                      {m.hasAudio && (
                        <div className={`mb-1 flex flex-col gap-1 max-w-[280px] ${mine ? 'items-end' : 'items-start'}`}>
                          <audio
                            controls
                            src={messageAudioUrl(conversationId, m.id)}
                            preload="metadata"
                            style={{ maxWidth: '100%', height: 40 }}
                          >
                            Ton navigateur supporte pas la balise audio.
                          </audio>
                          <a
                            href={messageAudioUrl(conversationId, m.id, { download: true })}
                            download={m.audioName || `audio-${m.id}.mp3`}
                            className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2"
                          >
                            ⬇ {m.audioName || `audio-${m.id}.mp3`}
                          </a>
                        </div>
                      )}
                      {m.body && (
                        <div
                          className={`px-3.5 py-2 text-[15px] leading-snug msg-body ${
                            mine ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-100'
                          }`}
                          style={{
                            wordBreak: 'break-word',
                            borderRadius: 18,
                            borderBottomRightRadius: mine && lastOfGroup ? 6 : 18,
                            borderBottomLeftRadius: !mine && lastOfGroup ? 6 : 18,
                          }}
                          dangerouslySetInnerHTML={{ __html: renderMessageBody(m.body) }}
                        />
                      )}
                      {/* Reactions pills (sous la bulle, cliquable pour toggle) */}
                      {m.reactions && m.reactions.length > 0 && (
                        <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'self-end' : 'self-start'}`}>
                          {m.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              type="button"
                              onClick={() => handleReact(m.id, r.emoji)}
                              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                                r.mine
                                  ? 'border-sky-400/60 bg-sky-500/20 text-sky-100'
                                  : 'border-white/10 bg-slate-800/70 text-slate-300 hover:bg-slate-700'
                              }`}
                              title={`${r.count} reaction${r.count > 1 ? 's' : ''}`}
                            >
                              <span>{r.emoji}</span>
                              <span className="font-medium">{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {lastOfGroup && (
                        <span className={`mt-0.5 px-1 text-[10px] text-slate-500 ${mine ? 'self-end' : 'self-start'}`}>
                          {formatTime(m.createdAt)}
                        </span>
                      )}
                    </div>
                    {mine && (
                      <div className="w-9 flex-shrink-0">
                        {lastOfGroup ? (
                          <Avatar
                            userId={user.id}
                            firstName={user.firstName}
                            src={user.avatarData || null}
                            size={32}
                          />
                        ) : null}
                      </div>
                    )}
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

      {/* Bandeau reply (en cours de reponse a un message) */}
      {replyingTo && (
        <div className="border-t border-sky-400/30 bg-sky-500/10 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 text-sky-300">↩</div>
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold text-sky-200">Réponse à {replyingTo.authorFirstName || 'Quelqu\'un'}</p>
              <p className="truncate text-sky-100/70">
                {replyingTo.hasAudio ? '🎵 ' : ''}
                {replyingTo.hasImage ? '📷 ' : ''}
                {replyingTo.body
                  ? (replyingTo.body.length > 80 ? replyingTo.body.slice(0, 77) + '…' : replyingTo.body)
                  : (replyingTo.hasAudio ? (replyingTo.audioName || 'Audio') : (replyingTo.hasImage ? 'Photo' : '...'))}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="h-8 w-8 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center"
              aria-label="Annuler la reponse"
            >
              <FontAwesomeIcon icon={UI.close} className="text-xs" />
            </button>
          </div>
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

      {/* Preview audio avant envoi */}
      {audioAttach && (
        <div className="border-t border-white/5 bg-slate-900/60 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-lg bg-slate-800 flex items-center justify-center text-2xl">🎵</div>
            <div className="min-w-0 flex-1 text-xs text-slate-300">
              <p className="truncate">{audioAttach.name}</p>
              <p className="text-slate-500">{humanBytes(audioAttach.bytes)} — {audioAttach.type}</p>
              <audio src={audioAttach.dataUrl} controls preload="metadata" style={{ height: 28, marginTop: 4, maxWidth: '100%' }} />
            </div>
            <button
              onClick={() => setAudioAttach(null)}
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
          aria-label="Joindre une image ou un audio"
          className="h-11 w-11 flex-shrink-0 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center disabled:opacity-50"
        >
          <FontAwesomeIcon icon={UI.plus} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*"
          className="hidden"
          onChange={onPickFile}
        />
        <div className="flex flex-1 flex-col rounded-3xl border border-white/10 bg-slate-900 px-2 py-1 focus-within:border-sky-500/60">
          {/* Toolbar formatage (mini) */}
          <div className="flex items-center gap-0.5 px-1 pt-1 pb-0.5">
            <button type="button" onClick={() => insertWrap('**')} title="Gras (Cmd/Ctrl+B)" className="h-7 w-7 rounded-md text-xs font-bold text-slate-300 hover:bg-white/10 transition">B</button>
            <button type="button" onClick={() => insertWrap('*')} title="Italique" className="h-7 w-7 rounded-md text-xs italic text-slate-300 hover:bg-white/10 transition">I</button>
            <button type="button" onClick={() => insertWrap('~~')} title="Barre" className="h-7 w-7 rounded-md text-xs text-slate-300 hover:bg-white/10 transition" style={{ textDecoration: 'line-through' }}>S</button>
            <button type="button" onClick={() => insertWrap('`', 'code')} title="Code" className="h-7 w-7 rounded-md text-xs font-mono text-slate-300 hover:bg-white/10 transition">{'<>'}</button>
            <span className="ml-auto text-[10px] text-slate-500 hidden sm:inline pr-1">⌘↵ envoyer</span>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Cmd/Ctrl + Enter = envoi (raccourci desktop). Enter seul = nouvelle ligne.
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  onSend();
                }
                // Cmd/Ctrl + B / I = bold / italic shortcut
                if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
                  if (e.key === 'b' || e.key === 'B') { e.preventDefault(); insertWrap('**'); }
                  else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); insertWrap('*'); }
                }
              }}
              placeholder={(attachPreview || audioAttach) ? "Ajoute un message (optionnel)…" : "Écris un message… (Entrée = nouvelle ligne)"}
              rows={1}
              className="flex-1 resize-none bg-transparent pl-2 py-2 text-[16px] text-white placeholder:text-slate-500 focus:outline-none"
              style={{ maxHeight: 140 }}
            />
            <button
              type="submit"
              disabled={sending || attaching || (!draft.trim() && !attachPreview && !audioAttach)}
              aria-label="Envoyer"
              className="my-1 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-sky-500 text-white transition hover:bg-sky-400 disabled:opacity-30"
            >
              <FontAwesomeIcon icon={UI.send} className="text-sm" />
            </button>
          </div>
        </div>
      </form>

      {/* Confirm suppression */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Supprimer la conversation ?</h3>
            <p className="mt-1 text-sm text-slate-400">
              Tous les messages seront perdus pour toi et les autres participants. Cette action est
              irréversible.
            </p>
            {error && (
              <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!validId) return;
                  setDeleting(true);
                  setError(null);
                  try {
                    await deleteConversation(conversationId);
                    router.push('/apps/messagerie');
                  } catch (e: any) {
                    setError(e?.message || 'Suppression impossible');
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="flex-1 rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles markdown light pour messages */}
      <style dangerouslySetInnerHTML={{ __html: `
        .msg-body strong { font-weight: 700; }
        .msg-body em { font-style: italic; }
        .msg-body del { text-decoration: line-through; opacity: 0.75; }
        .msg-body .msg-code, .msg-body code {
          background: rgba(0, 0, 0, 0.32);
          padding: 1px 5px;
          border-radius: 4px;
          font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
          font-size: 0.9em;
        }
        .msg-body br { line-height: 1.5; }
      ` }} />

      {/* Lightbox (image plein écran) */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={lightbox.downloadUrl}
            download="image.webp"
            onClick={(e) => e.stopPropagation()}
            aria-label="Télécharger l'image"
            className="absolute top-4 left-4 h-11 px-3 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center text-sm"
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
          >
            ⬇ Télécharger
          </a>
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
