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
  leaveConversation,
  editMessage,
  deleteMessage,
  sendTyping,
  conversationDisplayName,
  formatTime,
  formatDateSeparator,
  isSameCalendarDay,
  participantAvatarSrc,
  toggleReaction,
  messageImageUrl,
  messageAudioUrl,
  getMessagerieToken,
  REACTION_EMOJIS,
  type ConversationDetails,
  type Message,
  type MsgAuthor,
  type MessageReplyPreview,
} from '@/lib/messagerie-api';
import { openMessagerieStream } from '@/lib/messagerie-sse';
import Avatar from '@/components/Avatar';
import { compressImage, humanBytes } from '@/lib/image-utils';
import { setAppBadge } from '@/lib/app-badge';

// V2.6 : retire le polling 5s. On garde uniquement le refetch au visibilitychange
// (resync au cas où le stream SSE aurait manqué un event pendant un sleep).

// V1.2 : envoi optimistic — on attache un statut local au message pendant l'envoi.
type MessageStatus = 'sent' | 'pending' | 'failed';
type MessageWithStatus = Message & {
  _status?: MessageStatus;
  _retry?: {
    body: string;
    image?: { data: string; width?: number; height?: number };
    audio?: { data: string; type?: string; name?: string };
    replyToId?: number | null;
    localImageDataUrl?: string;
    localAudioDataUrl?: string;
    localAudioName?: string;
  };
};

// V2.9 : detection mobile pour Enter=newline vs Enter=send (clavier mobile vs desktop).
// On le calcule au mount pour eviter les recalculs a chaque keypress.
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch {
    return false;
  }
}

// V2.9 : duree max enregistrement vocal (2 min).
const MAX_RECORD_MS = 2 * 60 * 1000;

// V2.8 : fenetre d'edition d'un message cote client (affichage du bouton).
const EDIT_WINDOW_MS = 3 * 60 * 1000;

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

function renderMessageBody(text: string): string {
  if (!text) return '';
  let h = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  h = h.replace(/`([^`\n]+)`/g, '<code class="msg-code">$1</code>');
  h = h.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  h = h.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
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

// V2.9 : format MM:SS pour le compteur d'enregistrement.
function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // V2.9 : detection mobile (Enter=newline) vs desktop (Enter=send).
  const [isMobile, setIsMobile] = useState(false);

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

  // V2.9 : enregistrement vocal in-app via MediaRecorder.
  // States possibles : 'idle' | 'recording' | 'preview' (audio enregistre, en attente d'envoi).
  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [recordPreview, setRecordPreview] = useState<{ dataUrl: string; bytes: number; durationMs: number } | null>(null);
  const [micErrorModal, setMicErrorModal] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordStartedAtRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reply state : si set, le prochain envoi sera une reponse a ce message
  const [replyingTo, setReplyingTo] = useState<MessageReplyPreview | null>(null);

  // Active message menu (pour Copy / React / Reply). messageId ou null.
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [showReactPicker, setShowReactPicker] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<number | null>(null);

  // V2.8 : edit inline state.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // V2.8 : confirm delete message state.
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<number | null>(null);
  const [deletingMsg, setDeletingMsg] = useState(false);

  // Lightbox (tap image to zoom).
  const [lightbox, setLightbox] = useState<{ url: string; downloadUrl: string } | null>(null);

  // Menu ••• (delete + leave)
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // V2.7 : typing indicator. Map<userId, expiresAt>. Filtre les expires au render.
  const [typingMap, setTypingMap] = useState<Map<number, { displayName: string; expiresAt: number }>>(new Map());
  const lastTypingSentRef = useRef<number>(0);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // V2.6 : retire le polling. loadMessages reste utilise pour le visibilitychange
  // resync et le bootstrap initial.
  const loadMessages = useCallback(async () => {
    if (!validId) return;
    try {
      const { messages: fresh } = await listMessages(conversationId, { limit: 100 });
      setMessages((prev) => {
        const local = prev.filter((m) => m._status === 'pending' || m._status === 'failed');
        const freshLast = fresh.length ? fresh[fresh.length - 1].id : 0;
        const prevServer = prev.filter((m) => !m._status || m._status === 'sent');
        const prevLast = prevServer.length ? prevServer[prevServer.length - 1].id : 0;
        if (prevLast === freshLast && prevServer.length === fresh.length && local.length === 0) return prev;
        const merged: MessageWithStatus[] = [
          ...fresh.map((m) => ({ ...m, _status: 'sent' as MessageStatus })),
          ...local,
        ];
        return merged;
      });
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    }
  }, [conversationId, validId]);

  useEffect(() => {
    setIsMobile(detectMobile());
  }, []);

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

  // V2.6 : ouverture du stream SSE. Remplace le polling 5s. On garde un
  // visibilitychange refetch en filet de securite si le SSE a manque un event.
  useEffect(() => {
    if (!validId) return;
    const token = getMessagerieToken();
    if (!token) return;

    const unsubscribe = openMessagerieStream(token, {
      onMessage: (data) => {
        if (data.conversationId !== conversationId) return;
        const incoming = data.message as Message;
        setMessages((prev) => {
          // Si le message est deja la (envoye par moi via POST -> response), on le skip.
          if (prev.some((m) => m.id === incoming.id)) return prev;
          // Insertion ordonnee par id croissant.
          const next = [...prev, { ...incoming, _status: 'sent' as MessageStatus }];
          next.sort((a, b) => {
            // Garde les pending (id<0) a la fin, sinon trie par id croissant.
            const aPending = a._status === 'pending' || a._status === 'failed';
            const bPending = b._status === 'pending' || b._status === 'failed';
            if (aPending && !bPending) return 1;
            if (!aPending && bPending) return -1;
            return a.id - b.id;
          });
          return next;
        });
        // Marque comme lu immediatement si la convo est ouverte et visible.
        if (document.visibilityState === 'visible') {
          markConversationRead(conversationId).catch(() => {});
        }
      },
      onReaction: (data) => {
        if (data.conversationId !== conversationId) return;
        setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m)));
      },
      onEdit: (data) => {
        if (data.conversationId !== conversationId) return;
        setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, body: data.body, editedAt: data.editedAt } : m)));
      },
      onDelete: (data) => {
        if (data.conversationId !== conversationId) return;
        setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, body: '', hasImage: false, hasAudio: false, reactions: [], deletedAt: new Date().toISOString() } : m)));
      },
      onTyping: (data) => {
        if (data.conversationId !== conversationId) return;
        if (data.userId === user?.id) return; // pas mes propres signaux
        setTypingMap((prev) => {
          const next = new Map(prev);
          next.set(data.userId, { displayName: data.displayName, expiresAt: data.expiresAt });
          return next;
        });
      },
      onRead: (data) => {
        if (data.conversationId !== conversationId) return;
        // Update les reads de tous mes messages dont createdAt <= lastReadAt pour cet user.
        const lastReadAt = data.lastReadAt;
        const lastReadAtMs = new Date(lastReadAt).getTime();
        setMessages((prev) => prev.map((m) => {
          if (m.authorId !== user?.id) return m;
          if (new Date(m.createdAt).getTime() > lastReadAtMs) return m;
          const reads = (m.reads || []).filter((r) => r.userId !== data.userId);
          reads.push({ userId: data.userId, readAt: lastReadAt });
          return { ...m, reads };
        }));
      },
      onConversationDeleted: (data) => {
        if (data.conversationId === conversationId) {
          router.push('/apps/messagerie');
        }
      },
    });

    return unsubscribe;
  }, [conversationId, validId, router, user?.id]);

  // V2.7 : cleanup auto des typing indicators expires (toutes les 1s).
  useEffect(() => {
    const t = setInterval(() => {
      setTypingMap((prev) => {
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [uid, info] of prev) {
          if (info.expiresAt <= now) {
            next.delete(uid);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!validId) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        loadMessages();
        markConversationRead(conversationId).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
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

  useEffect(() => {
    const ta = editTextareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [editDraft, editingId]);

  // V2.9 : cleanup du MediaRecorder si l'user navigate ailleurs en plein enregistrement.
  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch { /* noop */ }
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    };
  }, []);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setError(null);
    if (file.type.startsWith('audio/')) {
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

  async function handleCopy(m: Message) {
    const txt = m.body || '(sans texte)';
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
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

  // V2.8 : enter edit mode.
  function handleStartEdit(m: Message) {
    setEditingId(m.id);
    setEditDraft(m.body || '');
    setActiveMenu(null);
    setTimeout(() => {
      const ta = editTextareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    }, 50);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditDraft('');
  }

  async function handleSaveEdit() {
    if (editingId == null) return;
    const newBody = editDraft.trim();
    if (!newBody) return;
    setEditSaving(true);
    try {
      const result = await editMessage(conversationId, editingId, newBody);
      setMessages((prev) => prev.map((m) => (m.id === editingId ? { ...m, body: result.body, editedAt: result.editedAt } : m)));
      setEditingId(null);
      setEditDraft('');
    } catch (e: any) {
      setError(e?.message || 'Edit impossible');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteMsg(messageId: number) {
    setDeletingMsg(true);
    try {
      await deleteMessage(conversationId, messageId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, body: '', hasImage: false, hasAudio: false, reactions: [], deletedAt: new Date().toISOString() } : m)));
      setConfirmDeleteMsg(null);
    } catch (e: any) {
      setError(e?.message || 'Suppression impossible');
    } finally {
      setDeletingMsg(false);
    }
  }

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
      const innerStart = start + marker.length;
      const innerEnd = innerStart + inner.length;
      ta.setSelectionRange(innerStart, innerEnd);
    }, 0);
  }

  const performSend = useCallback(async (tempId: number, payload: NonNullable<MessageWithStatus['_retry']>) => {
    if (!validId) return;
    try {
      const msg = await sendMessage(
        conversationId,
        payload.body,
        payload.image,
        payload.audio,
        payload.replyToId ?? null
      );
      setMessages((prev) => prev.map((m) => (m.id === tempId
        ? { ...msg, _status: 'sent' as MessageStatus }
        : m
      )));
    } catch (err: any) {
      setMessages((prev) => prev.map((m) => (m.id === tempId
        ? { ...m, _status: 'failed' as MessageStatus }
        : m
      )));
      setError(err?.message || "Erreur d'envoi");
    }
  }, [conversationId, validId]);

  const retryMessage = useCallback((m: MessageWithStatus) => {
    if (!m._retry) return;
    setMessages((prev) => prev.map((mm) => (mm.id === m.id ? { ...mm, _status: 'pending' as MessageStatus } : mm)));
    void performSend(m.id, m._retry);
  }, [performSend]);

  async function onSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const body = draft.trim();
    if (!validId) return;
    if (!body && !attachPreview && !audioAttach) return;
    setError(null);

    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    const payload: NonNullable<MessageWithStatus['_retry']> = {
      body,
      image: attachPreview ? { data: attachPreview.dataUrl, width: attachPreview.width, height: attachPreview.height } : undefined,
      audio: audioAttach ? { data: audioAttach.dataUrl, type: audioAttach.type, name: audioAttach.name } : undefined,
      replyToId: replyingTo ? replyingTo.id : null,
      localImageDataUrl: attachPreview?.dataUrl,
      localAudioDataUrl: audioAttach?.dataUrl,
      localAudioName: audioAttach?.name,
    };
    const optimistic: MessageWithStatus = {
      id: tempId,
      authorId: user?.id || 0,
      authorFirstName: user?.firstName || null,
      body,
      hasImage: !!attachPreview,
      imageWidth: attachPreview?.width || null,
      imageHeight: attachPreview?.height || null,
      hasAudio: !!audioAttach,
      audioType: audioAttach?.type || null,
      audioName: audioAttach?.name || null,
      replyTo: replyingTo || null,
      reactions: [],
      reads: [],
      createdAt: new Date().toISOString(),
      _status: 'pending',
      _retry: payload,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    setAttachPreview(null);
    setAudioAttach(null);
    setReplyingTo(null);
    window.setTimeout(() => scrollToBottom('smooth'), 30);
    textareaRef.current?.focus();
    void performSend(tempId, payload);
  }

  // V2.7 : debounce le typing signal a ~1s.
  function maybeSendTyping() {
    if (!validId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1000) return;
    lastTypingSentRef.current = now;
    sendTyping(conversationId).catch(() => {});
  }

  // V2.9 : enregistrement vocal in-app via MediaRecorder.
  async function startRecording() {
    if (recordState !== 'idle') return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      // Format prefere : webm opus (compatible Chrome/Firefox/Edge/Safari17+).
      // Si pas supporte, fallback au defaut du navigateur.
      let mimeType = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else mimeType = ''; // laisse au navigateur
      }
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];
      mr.addEventListener('dataavailable', (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      });
      mr.addEventListener('stop', () => {
        const stream = recordStreamRef.current;
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          recordStreamRef.current = null;
        }
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        const elapsed = Date.now() - recordStartedAtRef.current;
        const chunks = recordChunksRef.current;
        const type = (mr.mimeType || 'audio/webm').split(';')[0];
        const blob = new Blob(chunks, { type });
        recordChunksRef.current = [];
        // Convertit en data URL pour pouvoir envoyer.
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result);
          setRecordPreview({ dataUrl, bytes: blob.size, durationMs: elapsed });
          setRecordState('preview');
        };
        reader.onerror = () => {
          setError('Lecture de l\'enregistrement impossible');
          setRecordState('idle');
        };
        reader.readAsDataURL(blob);
      });
      mr.start();
      recordStartedAtRef.current = Date.now();
      setRecordElapsed(0);
      setRecordState('recording');
      recordTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordStartedAtRef.current;
        setRecordElapsed(elapsed);
        if (elapsed >= MAX_RECORD_MS) {
          stopRecording();
        }
      }, 200);
    } catch (err: any) {
      // Permission refusee / micro inaccessible / browser sans MediaRecorder.
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
      }
      setMicErrorModal(true);
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try { mr.stop(); } catch { /* noop */ }
    }
  }

  function cancelRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try { mr.stop(); } catch { /* noop */ }
    }
    if (recordStreamRef.current) {
      recordStreamRef.current.getTracks().forEach((t) => t.stop());
      recordStreamRef.current = null;
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    recordChunksRef.current = [];
    setRecordPreview(null);
    setRecordElapsed(0);
    setRecordState('idle');
  }

  async function sendRecording() {
    if (!recordPreview || !validId) return;
    // Detecte le mime depuis le data URL.
    const m = recordPreview.dataUrl.match(/^data:(audio\/[^;]+)/);
    const mime = m ? m[1] : 'audio/webm';
    const ext = mime.split('/')[1] || 'webm';
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    const audioPayload = {
      data: recordPreview.dataUrl,
      type: mime,
      name: `voice-${Date.now()}.${ext}`,
    };
    const retryPayload: NonNullable<MessageWithStatus['_retry']> = {
      body: '',
      audio: audioPayload,
      replyToId: replyingTo ? replyingTo.id : null,
      localAudioDataUrl: recordPreview.dataUrl,
      localAudioName: audioPayload.name,
    };
    const optimistic: MessageWithStatus = {
      id: tempId,
      authorId: user?.id || 0,
      authorFirstName: user?.firstName || null,
      body: '',
      hasAudio: true,
      audioType: mime,
      audioName: audioPayload.name,
      replyTo: replyingTo || null,
      reactions: [],
      reads: [],
      createdAt: new Date().toISOString(),
      _status: 'pending',
      _retry: retryPayload,
    };
    setMessages((prev) => [...prev, optimistic]);
    setReplyingTo(null);
    setRecordPreview(null);
    setRecordState('idle');
    setRecordElapsed(0);
    window.setTimeout(() => scrollToBottom('smooth'), 30);
    void performSend(tempId, retryPayload);
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

  // V2.7 : determine quel est le dernier message lu par chaque user (parmi mes
  // messages envoyes). Map<userId, messageId>. On affiche les mini-avatars de
  // ces users uniquement sous CE message — pas sous chaque message lu.
  const lastReadByUser = useMemo(() => {
    if (!user) return new Map<number, number>();
    const map = new Map<number, number>();
    // On parcourt mes messages dans l'ordre. Pour chaque user (autre que moi)
    // present dans m.reads, on retient le PLUS RECENT messageId qu'il a lu.
    for (const m of messages) {
      if (m.authorId !== user.id) continue;
      if (m._status && m._status !== 'sent') continue;
      for (const r of m.reads || []) {
        if (r.userId === user.id) continue;
        // Comme messages est ordonne par id croissant, le dernier set wins.
        map.set(r.userId, m.id);
      }
    }
    return map;
  }, [messages, user]);

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

  // V2.7 : typing list (filtre les expires juste avant le render).
  const now = Date.now();
  const activeTyping: Array<{ userId: number; displayName: string }> = [];
  for (const [uid, info] of typingMap) {
    if (info.expiresAt > now) activeTyping.push({ userId: uid, displayName: info.displayName });
  }
  let typingLabel = '';
  if (activeTyping.length === 1) typingLabel = `${activeTyping[0].displayName} écrit…`;
  else if (activeTyping.length === 2) typingLabel = `${activeTyping[0].displayName} et ${activeTyping[1].displayName} écrivent…`;
  else if (activeTyping.length > 2) typingLabel = `${activeTyping.length} personnes écrivent…`;

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
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
                  {(user.role === 'ADMIN' || (convo && convo.createdById === user.id)) && (
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
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmLeave(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-amber-200 hover:bg-amber-500/10"
                  >
                    <FontAwesomeIcon icon={UI.back} className="text-xs" />
                    Quitter la conversation
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

              const isDeleted = !!m.deletedAt;
              const isEditing = editingId === m.id;

              // V2.8 : determine si l'user courant peut editer / supprimer.
              const canEdit = !isDeleted && mine
                && (Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS)
                && !m._status; // pas pendant un envoi pending/failed
              const canDelete = !isDeleted && (mine || user.role === 'ADMIN') && !m._status;

              // V2.7 : qui voit cette bulle comme leur dernier lu ?
              const readersHere: number[] = [];
              if (mine && !isDeleted) {
                for (const [uid, msgId] of lastReadByUser) {
                  if (msgId === m.id) readersHere.push(uid);
                }
              }

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
                    <div
                      className={`max-w-[78%] flex flex-col ${mine ? 'items-end' : 'items-start'} group/msg relative ${
                        m._status === 'failed' ? 'rounded-2xl ring-2 ring-rose-500/60 ring-offset-2 ring-offset-slate-950 p-1' : ''
                      }`}
                      style={{ opacity: m._status === 'pending' ? 0.6 : 1 }}
                    >
                      {firstOfGroup && !mine && (
                        <span className="mb-0.5 px-1 text-[11px] text-slate-400">
                          {m.authorFirstName}
                        </span>
                      )}
                      {/* Bouton actions message (seulement si pas deleted / pas en edit) */}
                      {!isDeleted && !isEditing && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === m.id ? null : m.id); setShowReactPicker(null); }}
                          aria-label="Actions message"
                          className={`absolute -top-2 ${mine ? '-left-7' : '-right-7'} h-7 w-7 rounded-full bg-slate-800/80 text-slate-300 hover:bg-slate-700 transition flex items-center justify-center text-sm opacity-0 group-hover/msg:opacity-100 focus:opacity-100 z-10`}
                        >
                          ⋯
                        </button>
                      )}
                      {activeMenu === m.id && !isDeleted && !isEditing && (
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
                            {canEdit && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleStartEdit(m); }} title="Modifier" className="h-8 w-8 rounded-md text-slate-300 hover:bg-white/10 flex items-center justify-center text-sm">
                                ✎
                              </button>
                            )}
                            {canDelete && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setActiveMenu(null); setConfirmDeleteMsg(m.id); }} title="Supprimer" className="h-8 w-8 rounded-md text-rose-300 hover:bg-rose-500/20 flex items-center justify-center text-sm">
                                🗑
                              </button>
                            )}
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
                      {/* Reply preview (seulement si pas deleted) */}
                      {m.replyTo && !isDeleted && (
                        <div
                          className={`mb-0.5 max-w-full rounded-lg border-l-2 px-2.5 py-1 text-[12px] ${
                            mine ? 'border-sky-300/70 bg-sky-500/10 text-sky-100' : 'border-slate-500 bg-slate-800/60 text-slate-300'
                          }`}
                        >
                          <div className="font-semibold opacity-80">↩ {m.replyTo.authorFirstName || 'Quelqu\'un'}</div>
                          <div className="truncate opacity-90">
                            {m.replyTo.deletedAt ? (
                              <em className="opacity-60">Message supprimé</em>
                            ) : (
                              <>
                                {m.replyTo.hasAudio ? '🎵 ' : ''}
                                {m.replyTo.hasImage ? '📷 ' : ''}
                                {m.replyTo.body
                                  ? (m.replyTo.body.length > 100 ? m.replyTo.body.slice(0, 97) + '…' : m.replyTo.body)
                                  : (m.replyTo.hasAudio ? (m.replyTo.audioName || 'Audio') : (m.replyTo.hasImage ? 'Photo' : '...'))}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {!isDeleted && m.hasImage && (() => {
                        const isLocal = m.id < 0 && m._retry?.localImageDataUrl;
                        const imgSrc = isLocal
                          ? m._retry!.localImageDataUrl!
                          : messageImageUrl(conversationId, m.id);
                        const dlSrc = isLocal
                          ? m._retry!.localImageDataUrl!
                          : messageImageUrl(conversationId, m.id, { download: true });
                        return (
                          <div className={`mb-1 flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
                            <button
                              type="button"
                              onClick={() => setLightbox({ url: imgSrc, downloadUrl: dlSrc })}
                              className="max-w-full overflow-hidden rounded-2xl"
                              aria-label="Voir l'image"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imgSrc}
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
                            {!isLocal && (
                              <a
                                href={dlSrc}
                                download={`image-${m.id}.webp`}
                                className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2"
                              >
                                ⬇ Télécharger l'image
                              </a>
                            )}
                          </div>
                        );
                      })()}
                      {!isDeleted && m.hasAudio && (() => {
                        const isLocal = m.id < 0 && m._retry?.localAudioDataUrl;
                        const audSrc = isLocal
                          ? m._retry!.localAudioDataUrl!
                          : messageAudioUrl(conversationId, m.id);
                        return (
                          <div className={`mb-1 flex flex-col gap-1 max-w-[280px] ${mine ? 'items-end' : 'items-start'}`}>
                            <audio
                              controls
                              src={audSrc}
                              preload="metadata"
                              style={{ maxWidth: '100%', height: 40 }}
                            >
                              Ton navigateur supporte pas la balise audio.
                            </audio>
                            {!isLocal && (
                              <a
                                href={messageAudioUrl(conversationId, m.id, { download: true })}
                                download={m.audioName || `audio-${m.id}.mp3`}
                                className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2"
                              >
                                ⬇ {m.audioName || `audio-${m.id}.mp3`}
                              </a>
                            )}
                          </div>
                        );
                      })()}
                      {isDeleted ? (
                        <div
                          className={`px-3.5 py-2 text-[14px] italic ${
                            mine ? 'bg-sky-500/20 text-sky-100/70' : 'bg-slate-800/70 text-slate-400'
                          }`}
                          style={{ borderRadius: 18, borderBottomRightRadius: mine && lastOfGroup ? 6 : 18, borderBottomLeftRadius: !mine && lastOfGroup ? 6 : 18 }}
                        >
                          🗑 Message supprimé
                        </div>
                      ) : isEditing ? (
                        <div className={`${mine ? 'bg-sky-500/20 border border-sky-400/50' : 'bg-slate-800 border border-slate-600'} rounded-2xl p-2 w-full`}>
                          <textarea
                            ref={editTextareaRef}
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelEdit();
                              }
                              if (e.key === 'Enter' && !e.shiftKey && !isMobile && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                void handleSaveEdit();
                              }
                            }}
                            rows={1}
                            disabled={editSaving}
                            className="w-full resize-none bg-transparent text-[15px] text-white placeholder:text-slate-400 focus:outline-none"
                            style={{ minWidth: 200, maxHeight: 140 }}
                            placeholder="Modifier…"
                          />
                          <div className="mt-1 flex justify-end gap-1">
                            <button type="button" onClick={handleCancelEdit} disabled={editSaving} className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-white/10">
                              Annuler (Esc)
                            </button>
                            <button type="button" onClick={handleSaveEdit} disabled={editSaving || !editDraft.trim()} className="rounded-md bg-sky-500 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50">
                              {editSaving ? 'Enreg…' : 'Enregistrer'}
                            </button>
                          </div>
                        </div>
                      ) : m.body ? (
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
                      ) : null}
                      {/* Reactions pills (cache si deleted) */}
                      {!isDeleted && m.reactions && m.reactions.length > 0 && (
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
                        <span className={`mt-0.5 px-1 text-[10px] text-slate-500 ${mine ? 'self-end' : 'self-start'} flex items-center gap-1.5`}>
                          {formatTime(m.createdAt)}
                          {m.editedAt && !isDeleted && (
                            <span className="text-slate-500" title={`Modifie ${formatTime(m.editedAt)}`}>(modifié)</span>
                          )}
                          {m._status === 'pending' && (
                            <span className="text-slate-400" title="Envoi en cours">⏳ Envoi…</span>
                          )}
                          {m._status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => retryMessage(m)}
                              className="rounded-md border border-rose-500/60 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/20"
                              title="Reessayer l'envoi"
                            >
                              ↻ Réessayer
                            </button>
                          )}
                        </span>
                      )}
                      {/* V2.7 : mini-avatars des users qui ont lu ce message (uniquement les lecteurs dont c'est le DERNIER lu) */}
                      {readersHere.length > 0 && (
                        <div className="mt-0.5 flex -space-x-1 self-end" aria-label={`Lu par ${readersHere.length}`}>
                          {readersHere.slice(0, 4).map((uid) => {
                            const info = authorMap[uid];
                            if (!info) return null;
                            return (
                              <Avatar
                                key={uid}
                                userId={uid}
                                firstName={info.firstName}
                                src={participantAvatarSrc({
                                  id: uid,
                                  firstName: info.firstName,
                                  hasAvatar: info.hasAvatar,
                                  avatarUpdatedAt: info.avatarUpdatedAt || null,
                                })}
                                size={16}
                                ring
                                ringColor="#020617"
                              />
                            );
                          })}
                        </div>
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
        {/* V2.7 : typing indicator (en bas du scroller, juste avant le composer) */}
        {typingLabel && (
          <div className="mt-2 flex items-center gap-2 px-1 text-xs text-slate-400">
            <span className="flex gap-0.5">
              <span className="typing-dot" />
              <span className="typing-dot" style={{ animationDelay: '0.15s' }} />
              <span className="typing-dot" style={{ animationDelay: '0.3s' }} />
            </span>
            <span>{typingLabel}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Bandeau reply */}
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

      {/* Preview audio avant envoi (file pickle) */}
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

      {/* V2.9 : barre d'enregistrement vocal (visible si recording / preview) */}
      {recordState === 'recording' && (
        <div className="border-t border-rose-500/40 bg-rose-500/10 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-3">
            <span className="record-pulse h-3 w-3 rounded-full bg-rose-500" />
            <div className="flex-1 text-sm text-rose-100">
              <span className="font-semibold">{formatMs(recordElapsed)}</span>
              <span className="text-rose-200/60"> / {formatMs(MAX_RECORD_MS)}</span>
              <span className="ml-2 text-xs text-rose-200/70">Enregistrement en cours…</span>
            </div>
            <button type="button" onClick={stopRecording} className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-400">
              ⏹ Stop
            </button>
            <button type="button" onClick={cancelRecording} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700">
              ❌ Annuler
            </button>
          </div>
        </div>
      )}
      {recordState === 'preview' && recordPreview && (
        <div className="border-t border-sky-400/30 bg-sky-500/10 px-3 py-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-slate-800 flex items-center justify-center text-2xl">🎤</div>
            <div className="min-w-0 flex-1 text-xs text-slate-300">
              <p className="truncate">Enregistrement vocal — {formatMs(recordPreview.durationMs)} — {humanBytes(recordPreview.bytes)}</p>
              <audio src={recordPreview.dataUrl} controls preload="metadata" style={{ height: 28, marginTop: 4, maxWidth: '100%' }} />
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={sendRecording} className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-400">
                Envoyer
              </button>
              <button type="button" onClick={() => { setRecordPreview(null); setRecordState('idle'); startRecording(); }} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700">
                Refaire
              </button>
              <button type="button" onClick={cancelRecording} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700">
                Annuler
              </button>
            </div>
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
          disabled={attaching || recordState !== 'idle'}
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
        {/* V2.9 : bouton micro pour enregistrement vocal in-app */}
        <button
          type="button"
          onClick={startRecording}
          disabled={recordState !== 'idle' || attaching}
          aria-label="Enregistrer un message vocal"
          title="Enregistrer un vocal"
          className="h-11 w-11 flex-shrink-0 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center disabled:opacity-50"
        >
          🎤
        </button>
        <div className="flex flex-1 flex-col rounded-3xl border border-white/10 bg-slate-900 px-2 py-1 focus-within:border-sky-500/60">
          <div className="flex items-center gap-0.5 px-1 pt-1 pb-0.5">
            <button type="button" onClick={() => insertWrap('**')} title="Gras (Cmd/Ctrl+B)" className="h-7 w-7 rounded-md text-xs font-bold text-slate-300 hover:bg-white/10 transition">B</button>
            <button type="button" onClick={() => insertWrap('*')} title="Italique" className="h-7 w-7 rounded-md text-xs italic text-slate-300 hover:bg-white/10 transition">I</button>
            <button type="button" onClick={() => insertWrap('~~')} title="Barre" className="h-7 w-7 rounded-md text-xs text-slate-300 hover:bg-white/10 transition" style={{ textDecoration: 'line-through' }}>S</button>
            <button type="button" onClick={() => insertWrap('`', 'code')} title="Code" className="h-7 w-7 rounded-md text-xs font-mono text-slate-300 hover:bg-white/10 transition">{'<>'}</button>
            <span className="ml-auto text-[10px] text-slate-500 hidden sm:inline pr-1">
              {isMobile ? '↵ nouvelle ligne' : 'Entrée envoyer · Shift+↵ ligne'}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); maybeSendTyping(); }}
              onKeyDown={(e) => {
                // V2.9 : Enter = send sur desktop (pointer fin), Enter = newline sur mobile.
                // Shift+Enter toujours = newline. Cmd/Ctrl+Enter toujours = send.
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  onSend();
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey
                    && !e.nativeEvent.isComposing && !isMobile) {
                  e.preventDefault();
                  onSend();
                  return;
                }
                if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
                  if (e.key === 'b' || e.key === 'B') { e.preventDefault(); insertWrap('**'); }
                  else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); insertWrap('*'); }
                }
              }}
              placeholder={(attachPreview || audioAttach) ? "Ajoute un message (optionnel)…" : (isMobile ? "Écris un message…" : "Écris un message… (Entrée = envoyer)")}
              rows={1}
              className="flex-1 resize-none bg-transparent pl-2 py-2 text-[16px] text-white placeholder:text-slate-500 focus:outline-none"
              style={{ maxHeight: 140 }}
            />
            <button
              type="submit"
              disabled={attaching || recordState !== 'idle' || (!draft.trim() && !attachPreview && !audioAttach)}
              aria-label="Envoyer"
              className="my-1 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-sky-500 text-white transition hover:bg-sky-400 disabled:opacity-30"
            >
              <FontAwesomeIcon icon={UI.send} className="text-sm" />
            </button>
          </div>
        </div>
      </form>

      {/* V1.4 : Confirm leave */}
      {confirmLeave && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => !leaving && setConfirmLeave(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Quitter la conversation ?</h3>
            <p className="mt-1 text-sm text-slate-400">
              Tu vas te retirer de cette conversation. Tu ne recevras plus les messages.
              Les autres participants gardent l'historique complet.
            </p>
            {error && (
              <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmLeave(false)}
                disabled={leaving}
                className="flex-1 rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!validId) return;
                  setLeaving(true);
                  setError(null);
                  try {
                    await leaveConversation(conversationId);
                    router.push('/apps/messagerie');
                  } catch (e: any) {
                    setError(e?.message || 'Impossible de quitter');
                    setLeaving(false);
                  }
                }}
                disabled={leaving}
                className="flex-1 rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-60"
              >
                {leaving ? 'Sortie…' : 'Quitter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm suppression conversation */}
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
              Tu vas supprimer cette conversation pour TOUS les participants. Cette action est
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

      {/* V2.8 : Confirm suppression message */}
      {confirmDeleteMsg != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => !deletingMsg && setConfirmDeleteMsg(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Supprimer ce message ?</h3>
            <p className="mt-1 text-sm text-slate-400">
              Cette action est définitive. Le contenu sera retiré pour tous les participants.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmDeleteMsg(null)}
                disabled={deletingMsg}
                className="flex-1 rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={() => confirmDeleteMsg != null && handleDeleteMsg(confirmDeleteMsg)}
                disabled={deletingMsg}
                className="flex-1 rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
              >
                {deletingMsg ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* V2.9 : modal d'erreur micro (permission refusee, browser sans MediaRecorder, etc.) */}
      {micErrorModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setMicErrorModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Micro inaccessible</h3>
            <p className="mt-2 text-sm text-slate-300">
              Pour enregistrer un message vocal, autorise l'accès au micro dans les réglages
              de ton navigateur (icône cadenas dans la barre d'adresse, puis Microphone → Autoriser).
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Sur iPhone : Réglages → Safari → Microphone → Autoriser.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setMicErrorModal(false)}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles markdown light + typing animation + record pulse */}
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
        .typing-dot {
          display: inline-block;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.4;
          animation: mc-typing 1.2s infinite ease-in-out both;
        }
        @keyframes mc-typing {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }
        .record-pulse {
          animation: mc-record-pulse 1s infinite ease-in-out;
        }
        @keyframes mc-record-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      ` }} />

      {/* Lightbox */}
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
