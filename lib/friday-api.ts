// Client API FRIDAY — pont chat vers l'agent Hermes domestique.
// Pattern : isolé de lib/api.ts comme messagerie-api.ts / kaz / push.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mc_token');
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

async function jsonOr<T>(res: Response, fallback: T): Promise<T> {
  try { return (await res.json()) as T; } catch { return fallback; }
}

// ───────── Types ─────────

export type FridayConversation = {
  id: number;
  title: string;
  pinned: boolean;
  archivedAt: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

export type FridayMessage = {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt: string;
};

export type BridgeStatus = {
  configured: boolean;
};

// ───────── CRUD conversations ─────────

export async function listFridayConversations(opts: { archived?: boolean } = {}): Promise<{
  conversations: FridayConversation[];
  bridge: BridgeStatus;
}> {
  const q = opts.archived ? '?archived=1' : '';
  const res = await authFetch(`/friday/conversations${q}`);
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
  return res.json();
}

export async function createFridayConversation(title?: string): Promise<{ conversation: FridayConversation }> {
  const res = await authFetch('/friday/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
  return res.json();
}

export async function getFridayConversation(id: number): Promise<{
  conversation: FridayConversation;
  messages: FridayMessage[];
}> {
  const res = await authFetch(`/friday/conversations/${id}`);
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
  return res.json();
}

export async function patchFridayConversation(
  id: number,
  patch: { title?: string; pinned?: boolean; archived?: boolean }
): Promise<{ conversation: FridayConversation }> {
  const res = await authFetch(`/friday/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
  return res.json();
}

export async function deleteFridayConversation(id: number): Promise<void> {
  const res = await authFetch(`/friday/conversations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
}

// ───────── Streaming send ─────────

export type StreamEvent =
  | { type: 'user-saved'; message: FridayMessage }
  | { type: 'title'; title: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; message: FridayMessage }
  | { type: 'error'; error: string; message?: FridayMessage }
  | { type: string; [k: string]: unknown }; // forward inconnus (thinking, tool-use…)

export type StreamHandlers = {
  onEvent: (ev: StreamEvent) => void;
  signal?: AbortSignal;
};

// Envoie un message + stream la réponse de FRIDAY via SSE.
// Le serveur émet des events JSON sur `data:` lines — on les parse et forward.
export async function streamFridayMessage(
  conversationId: number,
  content: string,
  handlers: StreamHandlers
): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/friday/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
    signal: handlers.signal,
  });

  if (!res.ok) {
    const data = await jsonOr<any>(res, {});
    throw new Error(data.erreur || `Erreur ${res.status}`);
  }
  if (!res.body) throw new Error('Réponse sans corps de stream.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of rawEvent.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr) continue;
        try {
          const ev = JSON.parse(dataStr) as StreamEvent;
          handlers.onEvent(ev);
        } catch {
          /* ignore non-JSON keepalives */
        }
      }
    }
  }
}

// ───────── UI helpers ─────────

export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
  if (diffDays < 7) return d.toLocaleDateString('fr-CA', { weekday: 'short' });
  return d.toLocaleDateString('fr-CA', { day: '2-digit', month: '2-digit' });
}
