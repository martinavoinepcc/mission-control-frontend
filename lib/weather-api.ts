// Client API — météo (Open-Meteo proxy côté backend Mission Control)
// Séparé de lib/api.ts pour éviter de toucher le fichier central.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.my-mission-control.com';

export type WeatherHour = {
  time: string;
  tempC: number | null;
  weatherCode: number | null;
  weatherLabel: string;
  iconSlug: string;
  precipProbability: number | null;
};

export type WeatherPayload = {
  location: { label: string; lat: number; lon: number };
  current: {
    tempC: number | null;
    feelsLikeC: number | null;
    humidity: number | null;
    windKmh: number | null;
    windDir: number | null;
    weatherCode: number | null;
    weatherLabel: string;
    iconSlug: string;
    isDay: boolean;
    observedAt: string;
  };
  forecast: WeatherHour[];
  fetchedAt: string;
  source: string;
  cached?: boolean;
  stale?: boolean;
};

export async function getWeatherTroisRives(): Promise<WeatherPayload> {
  const res = await fetch(`${API_URL}/weather/trois-rives`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Météo indisponible (' + res.status + ')');
  return res.json();
}
