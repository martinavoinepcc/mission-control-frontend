// Client push isolé — même pattern que weather-api.ts / hubitat-api.ts.
// N'importe pas lib/api.ts pour rester indépendant et faciliter l'évolution.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

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

// ---- Helpers ----

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// ---- Detection ----

export type PushEnv = {
  supported: boolean;
  standalone: boolean;        // true si la PWA est "installée" (écran d'accueil)
  ios: boolean;
  iosVersionOk: boolean;      // iOS 16.4+ requis pour Web Push
  permission: NotificationPermission | 'default';
  vapidConfigured: boolean;
};

export function detectPushEnv(): PushEnv {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      standalone: false,
      ios: false,
      iosVersionOk: false,
      permission: 'default',
      vapidConfigured: !!VAPID_PUBLIC,
    };
  }

  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  let iosMajor = 0;
  let iosMinor = 0;
  const match = ua.match(/OS (\d+)_(\d+)/);
  if (match) {
    iosMajor = parseInt(match[1], 10) || 0;
    iosMinor = parseInt(match[2], 10) || 0;
  }
  const iosVersionOk = !ios || iosMajor > 16 || (iosMajor === 16 && iosMinor >= 4);

  const standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as any).standalone === true;

  const supported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const permission = ('Notification' in window ? Notification.permission : 'default') as
    | NotificationPermission
    | 'default';

  return {
    supported,
    standalone,
    ios,
    iosVersionOk,
    permission,
    vapidConfigured: !!VAPID_PUBLIC,
  };
}

// ---- Subscribe / unsubscribe ----

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker non supporté.');
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function subscribeToPush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const env = detectPushEnv();
    if (!env.supported) return { ok: false, reason: 'Navigateur non supporté.' };
    if (env.ios && !env.standalone) {
      return { ok: false, reason: 'iOS: ajoute d\'abord la PWA à l\'écran d\'accueil.' };
    }
    if (!VAPID_PUBLIC) return { ok: false, reason: 'Clé VAPID absente côté client.' };

    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return { ok: false, reason: 'Permission refusée.' };
    } else if (Notification.permission === 'denied') {
      return { ok: false, reason: 'Notifications bloquées dans les réglages du navigateur.' };
    }

    const reg = await ensureServiceWorker();
    // Attendre qu'il soit actif (certains nav retournent une registration "installing")
    if (!reg.active) {
      await new Promise<void>((resolve) => {
        const sw = reg.installing || reg.waiting;
        if (!sw) return resolve();
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve();
        });
      });
    }

    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      }));

    const p256dh = arrayBufferToBase64(sub.getKey('p256dh'));
    const auth = arrayBufferToBase64(sub.getKey('auth'));

    const res = await authFetch('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh, auth },
        userAgent: navigator.userAgent,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, reason: (data as any)?.erreur || `Erreur ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'Erreur inconnue' };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return { ok: true };
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { ok: true };

    await authFetch('/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
    return { ok: true };
  } catch (_err) {
    return { ok: false };
  }
}

export async function sendTestPush(): Promise<{ ok: boolean; sent?: number; failed?: number; pruned?: number; reason?: string }> {
  const res = await authFetch('/push/test', { method: 'POST', body: JSON.stringify({}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: (data as any)?.erreur || `Erreur ${res.status}` };
  return { ok: true, ...data };
}

export async function getPushStatus(): Promise<{ count: number; vapidConfigured: boolean } | null> {
  const res = await authFetch('/push/status', { method: 'GET' });
  if (!res.ok) return null;
  return res.json();
}
