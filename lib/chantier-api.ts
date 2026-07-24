// Client API — module Chantier Chalet (gestion de construction).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mc_token');
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.erreur || `Erreur ${res.status}`);
  return data as T;
}

// ===== Types =====

export type ChantierPhase = 'PRE_CONSTRUCTION' | 'CONSTRUCTION';
export type JalonStatus = 'A_VENIR' | 'EN_COURS' | 'COMPLETE' | 'EN_RETARD' | 'BLOQUE';
export type SoumissionStatus = 'RECUE' | 'EN_ANALYSE' | 'ACCEPTEE' | 'REFUSEE';
export type DepenseType = 'DEPOT' | 'PARTIEL' | 'FINAL' | 'EXTRA';
export type DocKind = 'PLAN' | 'PERMIS' | 'CONTRAT' | 'PHOTO' | 'RECU' | 'AUTRE';
export type ContactStatus = 'PRESSENTI' | 'SOUMISSION_RECUE' | 'RETENU' | 'ECARTE';

export type Project = {
  id: number;
  slug: string;
  name: string;
  address: string | null;
  budgetTotal: number;
  startDate: string | null;
  status: string;
};

export type Trade = {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  budgetPrevu: number;
  order: number;
};

export type TradeSummary = {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  budgetPrevu: number;
  soumissionsCount: number;
  statut: 'A_VENIR' | 'SOUMISSIONS' | 'ATTRIBUE' | 'EN_COURS' | 'TERMINE';
};

export type ContactLite = {
  id: number;
  company: string;
  person: string | null;
  phone: string | null;
  email: string | null;
};

export type Contact = ContactLite & {
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  address: string | null;
  rbq: string | null;
  trade: string | null;
  status: ContactStatus;
  notes: string | null;
  soumissions?: Array<{ id: number; amount: number; status: SoumissionStatus }>;
};

export type DebourseBanque = {
  id: number;
  label: string;
  amount: number;
  condition: string | null;
  datePrevue: string | null;
  dateRecu: string | null;
  recu: boolean;
  order: number;
};

export type JalonLite = {
  id: number;
  name: string;
  description: string | null;
  phase: ChantierPhase;
  status: JalonStatus;
  progress: number;
  dueDate: string | null;
  doneDate: string | null;
  order: number;
  tradeId: number | null;
  trade?: { id: number; name: string; color: string | null } | null;
  _count?: { soumissions: number; docs: number; depenses: number };
};

export type Soumission = {
  id: number;
  label: string | null;
  amount: number;
  status: SoumissionStatus;
  receivedAt: string | null;
  notes: string | null;
  tradeId: number | null;
  jalonId: number | null;
  contactId: number | null;
  contact?: ContactLite | null;
  trade?: { id: number; name: string; color: string | null } | null;
  jalon?: { id: number; name: string } | null;
};

export type Depense = {
  id: number;
  label: string | null;
  amount: number;
  type: DepenseType;
  method: string | null;
  paidAt: string | null;
  notes: string | null;
  tradeId: number | null;
  jalonId: number | null;
  trade?: { id: number; name: string } | null;
  jalon?: { id: number; name: string } | null;
};

export type Doc = {
  id: number;
  kind: DocKind;
  title: string;
  mimeType: string | null;
  fileUrl: string | null;
  width?: number | null;
  height?: number | null;
  takenAt?: string | null;
  createdAt: string;
  jalonId: number | null;
  tradeId?: number | null;
};

export type Overview = {
  project: Project;
  budget: { total: number; engage: number; paye: number; restant: number };
  banque?: { totalPrevu: number; totalRecu: number; count: number; countRecu: number };
  globalProgress: number;
  counts: {
    trades: number;
    contacts: number;
    jalons: number;
    jalonsComplete: number;
    jalonsRetard: number;
    soumissions: { total: number; recue: number; enAnalyse: number; acceptee: number; refusee: number };
    photos: number;
  };
  nextJalons: JalonLite[];
  trades: TradeSummary[];
  recentPhotos: Doc[];
};

export type JalonDetail = JalonLite & {
  soumissions: Soumission[];
  depenses: Depense[];
  docs: Doc[];
};

// ===== Endpoints =====

export const ChantierAPI = {
  overview: () => req<Overview>('/chantier/overview'),
  updateProject: (body: Partial<Project>) =>
    req<{ project: Project }>('/chantier/project', { method: 'PATCH', body: JSON.stringify(body) }),

  trades: () => req<{ trades: Trade[] }>('/chantier/trades'),
  createTrade: (body: Partial<Trade>) =>
    req<{ trade: Trade }>('/chantier/trades', { method: 'POST', body: JSON.stringify(body) }),
  updateTrade: (id: number, body: Partial<Trade>) =>
    req<{ trade: Trade }>(`/chantier/trades/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTrade: (id: number) => req<{ ok: true }>(`/chantier/trades/${id}`, { method: 'DELETE' }),

  contacts: () => req<{ contacts: Contact[] }>('/chantier/contacts'),
  createContact: (body: Partial<Contact>) =>
    req<{ contact: Contact }>('/chantier/contacts', { method: 'POST', body: JSON.stringify(body) }),
  updateContact: (id: number, body: Partial<Contact>) =>
    req<{ contact: Contact }>(`/chantier/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteContact: (id: number) => req<{ ok: true }>(`/chantier/contacts/${id}`, { method: 'DELETE' }),

  jalons: () => req<{ jalons: JalonLite[] }>('/chantier/jalons'),
  jalon: (id: number) => req<{ jalon: JalonDetail }>(`/chantier/jalons/${id}`),
  createJalon: (body: Partial<JalonLite>) =>
    req<{ jalon: JalonLite }>('/chantier/jalons', { method: 'POST', body: JSON.stringify(body) }),
  updateJalon: (id: number, body: Partial<JalonLite>) =>
    req<{ jalon: JalonLite }>(`/chantier/jalons/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteJalon: (id: number) => req<{ ok: true }>(`/chantier/jalons/${id}`, { method: 'DELETE' }),

  soumissions: (params?: { jalonId?: number; tradeId?: number }) => {
    const q = new URLSearchParams();
    if (params?.jalonId) q.set('jalonId', String(params.jalonId));
    if (params?.tradeId) q.set('tradeId', String(params.tradeId));
    const qs = q.toString();
    return req<{ soumissions: Soumission[] }>(`/chantier/soumissions${qs ? `?${qs}` : ''}`);
  },
  createSoumission: (body: Partial<Soumission>) =>
    req<{ soumission: Soumission }>('/chantier/soumissions', { method: 'POST', body: JSON.stringify(body) }),
  updateSoumission: (id: number, body: Partial<Soumission>) =>
    req<{ soumission: Soumission }>(`/chantier/soumissions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSoumission: (id: number) => req<{ ok: true }>(`/chantier/soumissions/${id}`, { method: 'DELETE' }),

  debourses: () => req<{ debourses: DebourseBanque[] }>('/chantier/debourses'),
  createDebourse: (body: Partial<DebourseBanque>) =>
    req<{ debourse: DebourseBanque }>('/chantier/debourses', { method: 'POST', body: JSON.stringify(body) }),
  updateDebourse: (id: number, body: Partial<DebourseBanque>) =>
    req<{ debourse: DebourseBanque }>(`/chantier/debourses/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDebourse: (id: number) => req<{ ok: true }>(`/chantier/debourses/${id}`, { method: 'DELETE' }),

  depenses: () => req<{ depenses: Depense[] }>('/chantier/depenses'),
  createDepense: (body: Partial<Depense>) =>
    req<{ depense: Depense }>('/chantier/depenses', { method: 'POST', body: JSON.stringify(body) }),
  deleteDepense: (id: number) => req<{ ok: true }>(`/chantier/depenses/${id}`, { method: 'DELETE' }),

  docs: (params?: { kind?: DocKind; jalonId?: number }) => {
    const q = new URLSearchParams();
    if (params?.kind) q.set('kind', params.kind);
    if (params?.jalonId) q.set('jalonId', String(params.jalonId));
    const qs = q.toString();
    return req<{ docs: Doc[] }>(`/chantier/docs${qs ? `?${qs}` : ''}`);
  },
  createDoc: (body: {
    kind: DocKind; title: string; fileData?: string; fileUrl?: string; mimeType?: string;
    width?: number; height?: number; takenAt?: string; jalonId?: number; tradeId?: number; soumissionId?: number;
  }) => req<{ doc: Doc }>('/chantier/docs', { method: 'POST', body: JSON.stringify(body) }),
  deleteDoc: (id: number) => req<{ ok: true }>(`/chantier/docs/${id}`, { method: 'DELETE' }),
};

// URL pour afficher un fichier (photo/plan). Prefere fileUrl (photos seedees),
// sinon l'endpoint /raw avec ?token= (les <img> ne peuvent pas envoyer de header).
export function docFileUrl(doc: { id: number; fileUrl?: string | null }): string {
  if (doc.fileUrl) return doc.fileUrl;
  const token = typeof window !== 'undefined' ? localStorage.getItem('mc_token') : null;
  return `${API_URL}/chantier/docs/${doc.id}/raw${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

// Compression image cote client -> data URL webp (limite la taille en DB).
export async function compressImage(file: File, maxDim = 1600, quality = 0.72): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl0 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl0;
  });
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: dataUrl0, width, height };
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/webp', quality);
  return { dataUrl, width, height };
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n || 0);
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}
