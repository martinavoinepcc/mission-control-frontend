// V2.6 : client SSE pour la messagerie realtime.
//
// Architecture :
// - openMessagerieStream(token, handlers) ouvre un EventSource long-lived
//   et reconnect auto avec backoff exponentiel (1s -> 30s max).
// - Le serveur emet des events nommes ('message:new', 'message:reaction',
//   'message:edit', 'message:delete', 'read', 'typing', 'conversation:deleted',
//   'participant:leave'). Chaque handler reçoit le JSON parsé.
// - Le caller cleanup en appelant la fonction retournee (unsubscribe).
//
// Auth : le JWT passe en ?token=<jwt> (EventSource API ne supporte pas les
// headers custom). Le backend accepte ce fallback via middleware/auth.js.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

// Payloads bruts emis par le backend (cf. messagerie.js + messagerie-sse.js).
export type SseMessageNew = {
  conversationId: number;
  message: any; // Message format (sans imageData/audioData)
};

export type SseMessageReaction = {
  conversationId: number;
  messageId: number;
  reactions: Array<{ emoji: string; count: number; mine: boolean; userIds: number[] }>;
};

export type SseMessageEdit = {
  conversationId: number;
  messageId: number;
  body: string;
  editedAt: string;
};

export type SseMessageDelete = {
  conversationId: number;
  messageId: number;
};

export type SseTyping = {
  conversationId: number;
  userId: number;
  displayName: string;
  expiresAt: number;
};

export type SseRead = {
  conversationId: number;
  userId: number;
  lastReadAt: string;
};

export type SseConversationDeleted = {
  conversationId: number;
};

export type SseParticipantLeave = {
  conversationId: number;
  userId: number;
};

export type MessagerieStreamHandlers = {
  onMessage?: (data: SseMessageNew) => void;
  onReaction?: (data: SseMessageReaction) => void;
  onEdit?: (data: SseMessageEdit) => void;
  onDelete?: (data: SseMessageDelete) => void;
  onTyping?: (data: SseTyping) => void;
  onRead?: (data: SseRead) => void;
  onConversationDeleted?: (data: SseConversationDeleted) => void;
  onParticipantLeave?: (data: SseParticipantLeave) => void;
  onOpen?: () => void;
  onError?: () => void;
};

/**
 * Ouvre un EventSource sur /messagerie/stream et branche les handlers.
 * Reconnect auto avec backoff exponentiel (1s -> 30s).
 * Retourne une fonction de cleanup a appeler en useEffect cleanup.
 */
export function openMessagerieStream(
  token: string,
  handlers: MessagerieStreamHandlers
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }
  const url = `${API_URL}/messagerie/stream?token=${encodeURIComponent(token)}`;
  let es: EventSource | null = null;
  let backoff = 1000;
  let cleanedUp = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function safeParse<T>(raw: string): T | null {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  function connect() {
    if (cleanedUp) return;
    try {
      es = new EventSource(url);
    } catch {
      // EventSource constructor throw (rare) → retry plus tard.
      scheduleReconnect();
      return;
    }
    es.addEventListener('message:new', (e: MessageEvent) => {
      const data = safeParse<SseMessageNew>(e.data);
      if (data) handlers.onMessage?.(data);
    });
    es.addEventListener('message:reaction', (e: MessageEvent) => {
      const data = safeParse<SseMessageReaction>(e.data);
      if (data) handlers.onReaction?.(data);
    });
    es.addEventListener('message:edit', (e: MessageEvent) => {
      const data = safeParse<SseMessageEdit>(e.data);
      if (data) handlers.onEdit?.(data);
    });
    es.addEventListener('message:delete', (e: MessageEvent) => {
      const data = safeParse<SseMessageDelete>(e.data);
      if (data) handlers.onDelete?.(data);
    });
    es.addEventListener('typing', (e: MessageEvent) => {
      const data = safeParse<SseTyping>(e.data);
      if (data) handlers.onTyping?.(data);
    });
    es.addEventListener('read', (e: MessageEvent) => {
      const data = safeParse<SseRead>(e.data);
      if (data) handlers.onRead?.(data);
    });
    es.addEventListener('conversation:deleted', (e: MessageEvent) => {
      const data = safeParse<SseConversationDeleted>(e.data);
      if (data) handlers.onConversationDeleted?.(data);
    });
    es.addEventListener('participant:leave', (e: MessageEvent) => {
      const data = safeParse<SseParticipantLeave>(e.data);
      if (data) handlers.onParticipantLeave?.(data);
    });
    es.onopen = () => {
      backoff = 1000;
      handlers.onOpen?.();
    };
    es.onerror = () => {
      // EventSource va passer en readyState=CLOSED si le serveur ferme la
      // connexion definitivement. En reseau intermittent, il essaie de
      // reconnect tout seul (readyState=CONNECTING). On ferme manuellement
      // pour avoir le controle complet du backoff.
      handlers.onError?.();
      try { es?.close(); } catch { /* noop */ }
      es = null;
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (cleanedUp) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, backoff);
    backoff = Math.min(backoff * 2, 30000);
  }

  connect();

  return () => {
    cleanedUp = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    try { es?.close(); } catch { /* noop */ }
    es = null;
  };
}
