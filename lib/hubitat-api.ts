// Client API — Hubitat (proxy côté backend Mission Control)
// Séparé de lib/api.ts pour isoler les changements.
// Le backend renvoie mode: 'STUB' ou 'LIVE' selon que HUBITAT_MAKER_TOKEN est set.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

export type HubitatLocation = 'MAISON' | 'CHALET';

export type HubitatDevice = {
  hubitatId: string;
  type: 'THERMOSTAT' | 'SENSOR' | 'SWITCH';
  label: string;
  room: string;
  currentTemp: number | null;
  setpoint: number | null;
  operatingState: string; // heating | idle | cooling | fan only
  humidity: number | null;
  mode: string; // heat | cool | off | auto
};

export type ActivePreset = {
  slug: string;
  label: string;
  setpoint: number;
  appliedAt: string;
  scheduledReturnAt: string | null;
} | null;

export type HubitatDevicesResponse = {
  mode: 'STUB' | 'LIVE';
  location: HubitatLocation;
  devices: HubitatDevice[];
  activePreset: ActivePreset;
  note?: string;
};

export type HubitatHistoryPoint = {
  takenAt: string;
  deviceId: string;
  currentTemp: number;
  setpoint: number;
  operatingState: string;
  outdoorTemp: number | null;
};

export type HubitatHistoryResponse = {
  mode: 'STUB' | 'LIVE';
  location: HubitatLocation;
  hours: number;
  points: HubitatHistoryPoint[];
  synthetic?: boolean;
  note?: string;
};

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('mc_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getHubitatDevices(location: HubitatLocation): Promise<HubitatDevicesResponse> {
  const res = await fetch(`${API_URL}/hubitat/devices?location=${location}`, {
    headers: { ...authHeaders() },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Hubitat indisponible (' + res.status + ')');
  return res.json();
}

export async function setHubitatSetpoint(
  hubitatId: string,
  location: HubitatLocation,
  value: number
): Promise<{ mode: string; ok: boolean; device?: HubitatDevice }> {
  const res = await fetch(`${API_URL}/hubitat/devices/${encodeURIComponent(hubitatId)}/setpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ value, location }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).erreur || 'Erreur consigne ' + res.status);
  }
  return res.json();
}

export async function applyHubitatPreset(
  slug: string,
  location: HubitatLocation,
  scheduledReturnAt?: string | null
): Promise<{ mode: string; ok: boolean; applied: any; devices?: HubitatDevice[] }> {
  const res = await fetch(`${API_URL}/hubitat/preset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ slug, location, scheduledReturnAt: scheduledReturnAt || null }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).erreur || 'Erreur preset ' + res.status);
  }
  return res.json();
}

export async function getHubitatHistory(
  location: HubitatLocation,
  hours: number = 24
): Promise<HubitatHistoryResponse> {
  const res = await fetch(`${API_URL}/hubitat/history?location=${location}&hours=${hours}`, {
    headers: { ...authHeaders() },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Historique indisponible (' + res.status + ')');
  return res.json();
}
