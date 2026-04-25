'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faRobot, faPaperPlane, faArrowLeft, faBars,
  faXmark, faExclamationTriangle, faCircleNotch,
} from '@fortawesome/free-solid-svg-icons';
import {
  listFridayConversations, createFridayConversation, getFridayConversation,
  patchFridayConversation, deleteFridayConversation, streamFridayMessage,
  formatRelativeTime,
  type FridayConversation, type FridayMessage,
} from '@/lib/friday-api';
import { getMe, clearToken, type User } from '@/lib/api';

type LiveMessage = FridayMessage & { streaming?: boolean };

export default function FridayChat() {
  const router = useRouter();
  const params = useSearchParams();
  const idFromUrl = params.get('id');
  const activeId = idFromUrl ? Number.parseInt(idFromUrl, 10) : null;

  const [user, setUser] = useState<User | null>(null);
  const [bridgeConfigured, setBridgeConfigured] = useState<boolean | null>(null);
  const [bridgeActive, setBridgeActive] = useState<boolean>(false);
  const [convos, setConvos] = useState<FridayConversation[]>([]);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const streamingMessageId = useRef<number | null>(null);

  // ───── Auth + initial load ─────
  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setUser(me.user);
      } catch {
        clearToken();
        router.push('/');
      }
    })();
  }, [router]);

  const loadConvos = useCallback(async () => {
    setLoadingConvos(true);
    try {
      const data = await listFridayConversations();
      setConvos(data.conversations);
      setBridgeConfigured(data.bridge.configured);
      setBridgeActive(!!data.bridge.active);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement.');
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  useEffect(() => { loadConvos(); }, [loadConvos]);

  // ───── Load active conversation messages ─────
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    (async () => {
      try {
        const data = await getFridayConversation(activeId);
        if (!cancelled) setMessages(data.messages);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Erreur de chargement.');
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeId]);

  // Auto-scroll bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  // ───── Actions ─────

  async function newConversation() {
    try {
      const data = await createFridayConversation();
      setConvos((prev) => [data.conversation, ...prev]);
      router.push(`/apps/friday/?id=${data.conversation.id}`);
      setSidebarOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Impossible de créer la conversation.');
    }
  }

  async function selectConversation(id: number) {
    router.push(`/apps/friday/?id=${id}`);
    setSidebarOpen(false);
  }

  async function removeConversation(id: number) {
    if (!confirm('Supprimer cette conversation ? Les messages seront perdus.')) return;
    try {
      await deleteFridayConversation(id);
      setConvos((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) router.push('/apps/friday/');
    } catch (err: any) {
      setError(err?.message || 'Impossible de supprimer.');
    }
  }

  async function renameActive() {
    if (!activeId) return;
    const current = convos.find((c) => c.id === activeId);
    const next = prompt('Nouveau titre :', current?.title || '');
    if (!next || next === current?.title) return;
    try {
      const data = await patchFridayConversation(activeId, { title: next });
      setConvos((prev) => prev.map((c) => (c.id === activeId ? data.conversation : c)));
    } catch (err: any) {
      setError(err?.message || 'Impossible de renommer.');
    }
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;

    let conversationId = activeId;
    if (!conversationId) {
      // Crée une conversation puis route vers elle
      try {
        const data = await createFridayConversation();
        conversationId = data.conversation.id;
        setConvos((prev) => [data.conversation, ...prev]);
        router.replace(`/apps/friday/?id=${conversationId}`);
      } catch (err: any) {
        setError(err?.message || 'Impossible de créer la conversation.');
        return;
      }
    }

    setInput('');
    setStreaming(true);
    setError(null);

    // Optimistic user message (sera remplacé par user-saved)
    const optimisticUserId = -Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticUserId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      },
    ]);

    // Placeholder assistant streaming
    const placeholderId = -Date.now() - 1;
    streamingMessageId.current = placeholderId;
    setMessages((prev) => [
      ...prev,
      {
        id: placeholderId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        streaming: true,
      },
    ]);

    try {
      await streamFridayMessage(conversationId!, content, {
        onEvent: (ev) => {
          if (ev.type === 'user-saved') {
            const saved = (ev as any).message as FridayMessage;
            setMessages((prev) =>
              prev.map((m) => (m.id === optimisticUserId ? saved : m))
            );
          } else if (ev.type === 'delta') {
            const text = (ev as any).text || '';
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMessageId.current
                  ? { ...m, content: m.content + text }
                  : m
              )
            );
          } else if (ev.type === 'done') {
            const saved = (ev as any).message as FridayMessage;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMessageId.current
                  ? { ...saved, streaming: false }
                  : m
              )
            );
            streamingMessageId.current = null;
          } else if (ev.type === 'error') {
            const msg = (ev as any).error || 'Erreur FRIDAY.';
            const saved = (ev as any).message as FridayMessage | undefined;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMessageId.current
                  ? saved
                    ? { ...saved, streaming: false }
                    : { ...m, content: msg, errorMessage: msg, streaming: false }
                  : m
              )
            );
            setError(msg);
          } else if (ev.type === 'title') {
            const newTitle = (ev as any).title as string;
            setConvos((prev) =>
              prev.map((c) => (c.id === conversationId ? { ...c, title: newTitle } : c))
            );
          }
        },
      });
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de l\'envoi.');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMessageId.current
            ? { ...m, content: m.content || 'FRIDAY n\'a pas pu répondre.', streaming: false }
            : m
        )
      );
    } finally {
      // Si le stream s'est fermé sans qu'on ait reçu `done` (proxy timeout, network blip,
      // delta géant qui passe pas), on re-fetch la conversation depuis la DB. Ça récupère
      // le message FRIDAY saved côté serveur et remplace le placeholder bloqué.
      const incomplete = streamingMessageId.current !== null;
      setStreaming(false);
      streamingMessageId.current = null;
      if (incomplete && conversationId) {
        try {
          const data = await getFridayConversation(conversationId);
          setMessages(data.messages);
        } catch { /* silencieux — on a déjà affiché l'erreur */ }
      }
      loadConvos();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ───── Render ─────

  const activeConvo = useMemo(
    () => convos.find((c) => c.id === activeId) || null,
    [convos, activeId]
  );

  if (!user) {
    return (
      <main className="relative flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="absolute inset-0 cosmic-grid" />
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </main>
    );
  }

  return (
    <main className="relative flex overflow-hidden" style={{ height: '100dvh' }}>
      <div className="absolute inset-0 cosmic-grid pointer-events-none" />
      <div className="blob bg-neon-violet w-[400px] h-[400px] -top-32 -left-24 animate-pulse-slow opacity-40" />
      <div className="blob bg-neon-cyan w-[320px] h-[320px] -bottom-32 -right-24 animate-pulse-slow opacity-30" style={{ animationDelay: '2s' }} />

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar : full-width sur petit mobile, 320px sur tablette+ */}
      <aside
        className={`fixed lg:static z-40 inset-y-0 left-0 w-[88vw] sm:w-80 sm:max-w-[85vw] flex flex-col border-r border-white/10 bg-slate-950/95 backdrop-blur-xl transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center gap-2 px-4 h-14 border-b border-white/10 flex-shrink-0">
          <button
            onClick={() => router.push('/dashboard?realm=family')}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 text-white/70"
            aria-label="Retour au dashboard"
            title="Retour au dashboard"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#29D0FE20', border: '1px solid #29D0FE40' }}
            >
              <FontAwesomeIcon icon={faRobot} className="text-cyan-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-display font-semibold leading-tight truncate">FRIDAY</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40 truncate">
                Assistant personnel
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 text-white/70 lg:hidden"
            aria-label="Fermer"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="px-3 pt-3 flex-shrink-0">
          <button
            onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium bg-cyan-500/15 border border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/25 transition"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            Nouvelle conversation
          </button>
        </div>

        {bridgeConfigured === false && (
          <div className="mx-3 mt-3 rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-xs text-amber-200 flex items-start gap-2">
            <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5 flex-shrink-0" />
            <div>
              FRIDAY n&apos;est pas encore branchée. Configure <code className="text-amber-100">FRIDAY_HMAC_SECRET</code> dans Render et démarre la boucle de poll côté FRIDAY.
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {loadingConvos ? (
            <div className="px-3 py-6 text-center text-white/40 text-sm">Chargement…</div>
          ) : convos.length === 0 ? (
            <div className="px-3 py-6 text-center text-white/40 text-sm">
              Aucune conversation. Démarre la première.
            </div>
          ) : (
            convos.map((c) => (
              <button
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${
                  activeId === c.id
                    ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-100'
                    : 'text-white/70 hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-[10px] text-white/40">{formatRelativeTime(c.lastMessageAt)}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeConversation(c.id); }}
                  className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center text-white/50 hover:bg-rose-500/20 hover:text-rose-300 transition"
                  aria-label="Supprimer"
                  title="Supprimer"
                >
                  <FontAwesomeIcon icon={faTrash} className="text-xs" />
                </button>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3 text-[10px] text-white/40 flex-shrink-0">
          <div>Connecté : <span className="text-white/60">{user.firstName}</span></div>
          <div className="mt-0.5">
            FRIDAY :
            {bridgeConfigured === false ? (
              <span className="ml-1 text-amber-300">● non configurée</span>
            ) : bridgeActive ? (
              <span className="ml-1 text-emerald-300">● connectée</span>
            ) : bridgeConfigured ? (
              <span className="ml-1 text-amber-300">● en attente (boucle inactive)</span>
            ) : (
              <span className="ml-1 text-white/40">…</span>
            )}
          </div>
        </div>
      </aside>

      {/* Main chat */}
      <section
        className="relative z-10 flex-1 flex flex-col min-w-0 h-full"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <header className="flex items-center gap-2 px-3 sm:px-4 h-14 border-b border-white/10 bg-slate-950/60 backdrop-blur-md flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-11 h-11 rounded-lg flex items-center justify-center hover:bg-white/5 text-white/70 lg:hidden"
            aria-label="Ouvrir la liste des conversations"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>
          <div className="flex-1 min-w-0">
            {activeConvo ? (
              <button
                onClick={renameActive}
                className="text-left max-w-full truncate font-display font-semibold text-white/90 hover:text-white transition"
                title="Renommer la conversation"
              >
                {activeConvo.title}
              </button>
            ) : (
              <span className="font-display font-semibold text-white/60">FRIDAY</span>
            )}
          </div>
        </header>

        {error && (
          <div className="mx-4 mt-3 rounded-lg bg-rose-500/15 border border-rose-400/30 px-3 py-2 text-xs text-rose-200 flex items-start gap-2">
            <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-rose-200 hover:text-white">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {!activeId && messages.length === 0 && (
              <EmptyState bridgeConfigured={bridgeConfigured} />
            )}
            {loadingMessages && messages.length === 0 && (
              <div className="text-center text-white/40 text-sm py-8">Chargement…</div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} userName={user.firstName} />
            ))}
          </div>
        </div>

        <div
          className="border-t border-white/10 bg-slate-950/80 backdrop-blur-md px-3 sm:px-4 pt-3 flex-shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                bridgeConfigured === false
                  ? 'FRIDAY n\'est pas branchée — démarre sa boucle de poll.'
                  : 'Écris à FRIDAY…'
              }
              rows={1}
              // text-base = 16px : empêche iOS de zoomer auto sur le focus
              className="flex-1 resize-none rounded-2xl bg-white/5 border border-white/10 focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 outline-none px-4 py-3 text-base sm:text-sm text-white placeholder:text-white/30 max-h-[40vh]"
              disabled={streaming}
              autoComplete="off"
              autoCorrect="on"
              spellCheck={true}
              enterKeyHint="send"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
              className="h-12 w-12 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center bg-cyan-500 text-white hover:bg-cyan-400 active:scale-95 disabled:bg-white/10 disabled:text-white/30 transition flex-shrink-0"
              aria-label="Envoyer"
              title="Envoyer"
            >
              {streaming ? (
                <FontAwesomeIcon icon={faCircleNotch} className="animate-spin" />
              ) : (
                <FontAwesomeIcon icon={faPaperPlane} />
              )}
            </button>
          </div>
          <p className="max-w-3xl mx-auto text-[10px] text-white/30 mt-2 text-center hidden sm:block">
            FRIDAY peut faire des erreurs. Les conversations sont sauvegardées dans Mission Control.
          </p>
        </div>
      </section>
    </main>
  );
}

// ───────── Sub-components ─────────

function MessageBubble({ message, userName }: { message: LiveMessage; userName: string }) {
  const isUser = message.role === 'user';
  const isError = !!message.errorMessage;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: '#29D0FE20', border: '1px solid #29D0FE40' }}
        >
          <FontAwesomeIcon icon={faRobot} className="text-sm text-cyan-300" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-cyan-500 text-white rounded-br-sm'
              : isError
              ? 'bg-rose-500/15 border border-rose-400/30 text-rose-100 rounded-bl-sm'
              : 'bg-white/5 border border-white/10 text-white/90 rounded-bl-sm'
          }`}
        >
          {message.content || (message.streaming ? <StreamingDots /> : '…')}
          {message.streaming && message.content && <span className="ml-1 inline-block w-1 h-3 bg-white/60 animate-pulse" />}
        </div>
        <span className="text-[10px] text-white/30 px-2">
          {isUser ? userName : 'FRIDAY'} · {formatRelativeTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

function EmptyState({ bridgeConfigured }: { bridgeConfigured: boolean | null }) {
  return (
    <div className="text-center py-16">
      <div
        className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4"
        style={{ background: '#29D0FE20', border: '1px solid #29D0FE40' }}
      >
        <FontAwesomeIcon icon={faRobot} className="text-3xl text-cyan-300" />
      </div>
      <h2 className="text-2xl font-display font-bold mb-2">Bonjour. Je suis FRIDAY.</h2>
      <p className="text-white/50 text-sm max-w-md mx-auto">
        Ton assistant IA personnel. Pose-moi une question, demande-moi quelque chose, ou commence simplement à parler.
      </p>
      {bridgeConfigured === false && (
        <p className="mt-4 text-xs text-amber-200/80 max-w-md mx-auto">
          ⚠ FRIDAY n&apos;est pas encore connectée à la maison. Le chat répondra avec un message d&apos;erreur tant que le pont n&apos;est pas configuré dans Render.
        </p>
      )}
    </div>
  );
}
