// Endpoints admin — réservés au rôle ADMIN.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

function token() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mc_token');
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.erreur || `Erreur ${res.status}`);
  return data as T;
}

export type AdminUser = {
  id: number;
  email: string;
  firstName: string;
  role: 'ADMIN' | 'MEMBER';
  profile: 'ADULT' | 'CHILD';
  mustChangePassword: boolean;
  createdAt: string;
  apps: Array<{
    appId: number;
    slug: string;
    name: string;
    icon: string;
    color: string;
    hasAccess: boolean;
  }>;
};

export type AdminApp = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  isMockup: boolean;
  isActive: boolean;
};

export const AdminAPI = {
  listUsers: () => req<{ users: AdminUser[] }>('/admin/users'),
  listApps: () => req<{ apps: AdminApp[] }>('/admin/apps'),
  createUser: (body: { email: string; firstName: string; password: string; role: 'ADMIN' | 'MEMBER'; profile: 'ADULT' | 'CHILD' }) =>
    req<{ user: AdminUser }>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  setAppAccess: (userId: number, appId: number, hasAccess: boolean) =>
    req<{ message: string }>(`/admin/users/${userId}/apps`, { method: 'POST', body: JSON.stringify({ appId, hasAccess }) }),
  resetPassword: (userId: number, newPassword: string) =>
    req<{ message: string }>(`/admin/users/${userId}/password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  deleteUser: (userId: number) => req<{ message: string }>(`/admin/users/${userId}`, { method: 'DELETE' }),
};
