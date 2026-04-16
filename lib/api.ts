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
};

// Endpoints
export async function login(email: string, password: string) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
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
