// Client API pour le backend Mission Control.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mc_token');
}

export function setToken(token: string) {
  localStorage.setItem('mc_token', token);
}

export function clearToken() {
  localStorage.removeItem('mc_token');
  localStorage.removeItem('mc_user');
}

export function setStoredUser(user: unknown) {
  localStorage.setItem('mc_user', JSON.stringify(user));
}

export function getStoredUser(): any | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('mc_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.erreur || `Erreur ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

// Types
export type User = {
  id: number;
  email: string;
  username: string | null;
  firstName: string;
  role: 'ADMIN' | 'MEMBER';
  profile: 'ADULT' | 'CHILD';
  mustChangePassword: boolean;
};

export type App = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  isMockup: boolean;
  isActive: boolean;
  realm: 'FAMILY' | 'WORK';
};

// Endpoints
export async function login(identifier: string, password: string) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getMe() {
  return request<{ user: User; apps: App[] }>('/users/me', { method: 'GET' });
}

// ============ ÉDUCATIF ============

export type EduModuleSummary = {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverColor: string | null;
  coverIcon: string | null;
  version: string;
  avatarKey: string | null;
  totalLessons: number;
  completedLessons: number;
  starsEarned: number;
  xpEarned: number;
};

export type EduLessonSummary = {
  id: number;
  slug: string;
  chapter: number;
  order: number;
  kind: 'QUEST' | 'BOSS' | 'FREE' | 'CEREMONY';
  title: string;
  subtitle: string | null;
  conceptKey: string | null;
  status: 'LOCKED' | 'UNLOCKED' | 'IN_PROGRESS' | 'COMPLETED';
  stars: number;
  xpEarned: number;
  isUnlocked: boolean;
};

export type EduModuleDetail = {
  module: {
    id: number;
    slug: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    coverColor: string | null;
    coverIcon: string | null;
    version: string;
    avatarKey: string | null;
  };
  lessons: EduLessonSummary[];
};

export type EduLessonData = {
  briefing: { text: string; avatarClip?: string };
  world: {
    tileset: string;
    cols: number;
    rows: number;
    start: { x: number; y: number; dir: 'north' | 'south' | 'east' | 'west' };
    goal: { x: number; y: number } | null;
    items: Array<{ type: string; x: number; y: number; color?: string }>;
    obstacles: Array<{ type: string; x: number; y: number }>;
    backgroundMusic?: string;
  };
  toolbox: {
    categories: Array<{
      name: string;
      colour: string;
      blocks: Array<{ type: string; params?: any }>;
    }>;
  };
  starter: { xml: string } | null;
  success: {
    type: string;
    rules: any;
    maxBlocks?: number;
  };
  hints: string[];
  xpMax: number;
  stars: any;
  rexLines: { intro: string; onSuccess: string; onError: string };
};

export type EduLessonDetail = {
  lesson: {
    id: number;
    slug: string;
    chapter: number;
    order: number;
    kind: string;
    title: string;
    subtitle: string | null;
    conceptKey: string | null;
    data: EduLessonData;
  };
  module: {
    slug: string;
    title: string;
    avatarKey: string | null;
    coverColor: string | null;
  };
  progress: {
    status: string;
    stars: number;
    hintsUsed: number;
    attempts: number;
    xpEarned: number;
    savedCode: string | null;
  } | null;
};

export type EduMeStats = {
  totalXp: number;
  totalStars: number;
  rank: { slug: string; label: string; minXp: number };
  completedCount: number;
  badges: Array<{ slug: string; title: string; icon: string; earnedAt: string }>;
};

export async function getEduModules() {
  return request<{ modules: EduModuleSummary[] }>('/educatif/modules', { method: 'GET' });
}

export async function getEduModule(slug: string) {
  return request<EduModuleDetail>(`/educatif/modules/${slug}`, { method: 'GET' });
}

export async function getEduLesson(id: number) {
  return request<EduLessonDetail>(`/educatif/lessons/${id}`, { method: 'GET' });
}

export async function postEduProgress(lessonId: number, event: string, payload?: any) {
  return request<{ progress: any }>('/educatif/progress', {
    method: 'POST',
    body: JSON.stringify({ lessonId, event, payload }),
  });
}

export async function getEduMe() {
  return request<EduMeStats>('/educatif/me', { method: 'GET' });
}

// Admin educatif
export async function adminGetEduModules() {
  return request<{ modules: any[] }>('/admin/educatif/modules', { method: 'GET' });
}
export async function adminGetEduModule(id: number) {
  return request<any>(`/admin/educatif/modules/${id}`, { method: 'GET' });
}
export async function adminSetModuleAccess(moduleId: number, userId: number, hasAccess: boolean) {
  return request<{ message: string }>(`/admin/educatif/modules/${moduleId}/access`, {
    method: 'POST',
    body: JSON.stringify({ userId, hasAccess }),
  });
}
export async function adminImportPack(pack: { module: any; lessons: any[] }) {
  return request<any>('/admin/educatif/packs/import', {
    method: 'POST',
    body: JSON.stringify(pack),
  });
}
export async function adminGetEduProgress() {
  return request<{ children: any[] }>('/admin/educatif/progress', { method: 'GET' });
}
