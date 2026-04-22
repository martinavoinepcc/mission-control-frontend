// Client API messagerie — isolé de lib/api.ts pour suivre le pattern
// weather-api.ts / hubitat-api.ts / push-api.ts.

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
  try {
    const data = await res.json();
    return data as T;
  } catch {
    return fallback;
  }
}

// ---- Types (alignés sur le backend) ----

export type MsgAuthor = {
  id: number;
  firstName: string;
};

export type ConversationSummary = {
  id: number;
  slug: string | null;
  title: string | null;
  lastMessageAt: string;
  unreadCount: number;
  participants: MsgAuthor[];
  lastMessage:
    | {
        id: number;
        body: string;
        createdAt: string;
        authorId: number;
        authorFirstName: string | null;
      }
    | null;
};

export type ConversationDetails = {
  id: number;
  slug: string | null;
  title: string | null;
  createdAt: string;
  lastMessageAt: string;
  participants: Array<MsgAuthor & { username?: string | null }>;
};

export type Message = {
  id: number;
  authorId: number;
  authorFirstName: string | null;
  body: string;
  createdAt: string;
  editedAt?: string | null;
};

// ---- API calls ----

export async function listConversations(): Promise<ConversationSummary[]> {
  const res = await authFetch('/conversations');
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
  const data = await res.json();
  return data.conversations as ConversationSummary[];
}

export async function getConversation(id: number): Promise<ConversationDetails> {
  const res = await authFetch(`/conversations/${id}`);
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
  return (await res.json()) as ConversationDetails;
}

export async function listMessages(
  conversationId: number,
  opts: { limit?: number; before?: number } = {}
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.before) params.set('before', String(opts.before));
  const q = params.toString();
  const res = await authFetch(`/conversations/${conversationId}/messages${q ? '?' + q : ''}`);
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
  return (await res.json()) as { messages: Message[]; hasMore: boolean };
}

export async function sendMessage(conversationId: number, body: string): Promise<Message> {
  const res = await authFetch(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
  return (await res.json()) as Message;
}

export async function markConversationRead(conversationId: number): Promise<void> {
  await authFetch(`/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => {});
}

export async function createConversation(input: {
  title?: string;
  participantIds: number[];
}): Promise<ConversationDetails> {
  const res = await authFetch('/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await jsonOr<any>(res, {})).erreur || `Erreur ${res.status}`);
  return (await res.json()) as ConversationDetails;
}

// ---- UI helpers ----

export function conversationDisplayName(
  convo: { title: string | null; participants: MsgAuthor[] },
  currentUserId: number
): string {
  if (convo.title) return convo.title;
  const others = convo.participants.filter((p) => p.id !== currentUserId);
  if (others.length === 0) return 'Moi';
  if (others.length <= 3) return others.map((p) => p.firstName).join(', ');
  return `${others[0].firstName}, ${others[1].firstName} +${others.length - 2}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
  if (diffDays < 7) {
    return d.toLocaleDateString('fr-CA', { weekday: 'short' });
  }
  return d.toLocaleDateString('fr-CA', { day: '2-digit', month: '2-digit' });
}

// ---- Avatars (couleur stable par userId) ----

const AVATAR_COLORS = [
  { bg: 'bg-fuchsia-500',  hex: '#EC4899' },
  { bg: 'bg-violet-500',   hex: '#8B5CF6' },
  { bg: 'bg-cyan-500',     hex: '#06B6D4' },
  { bg: 'bg-amber-500',    hex: '#F59E0B' },
  { bg: 'bg-emerald-500',  hex: '#10B981' },
  { bg: 'bg-rose-500',     hex: '#F43F5E' },
  { bg: 'bg-sky-500',      hex: '#0EA5E9' },
  { bg: 'bg-indigo-500',   hex: '#6366F1' },
];

export function avatarColor(userId: number): { bg: string; hex: string } {
  const idx = Math.abs(userId) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function avatarInitial(firstName: string | null | undefined): string {
  if (!firstName) return '·';
  const trimmed = firstName.trim();
  if (!trimmed) return '·';
  // Supporte aussi les accents (Alizée → A, Marie-Josée → M)
  const first = trimmed.charAt(0).toUpperCase();
  return first;
}

// ---- Date separators pour le thread ----

export function formatDateSeparator(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Hier';
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
  if (diffDays < 7) {
    return d.toLocaleDateString('fr-CA', { weekday: 'long' });
  }
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Regroupe deux dates en "le même jour calendaire" (utilisé pour insérer les séparateurs)
export function isSameCalendarDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
