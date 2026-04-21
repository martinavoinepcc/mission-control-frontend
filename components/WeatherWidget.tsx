'use client';

// WeatherWidget — deux variantes :
//  - variant="compact"  : ligne unique (icône + temp + label) pour header/dashboard
//  - variant="rich"     : tuile complète avec ressenti, vent, humidité, forecast 12h

import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSun,
  faCloud,
  faCloudSun,
  faCloudRain,
  faCloudShowersHeavy,
  faSnowflake,
  faBolt,
  faSmog,
  faMoon,
  faWind,
  faDroplet,
  faTemperatureHalf,
  faCircleNotch,
} from '@fortawesome/free-solid-svg-icons';
import { getWeatherTroisRives, type WeatherPayload } from '@/lib/weather-api';

const ICON_MAP: Record<string, any> = {
  sun: faSun,
  'cloud-sun': faCloudSun,
  cloud: faCloud,
  'cloud-rain': faCloudRain,
  'cloud-showers-heavy': faCloudShowersHeavy,
  snowflake: faSnowflake,
  bolt: faBolt,
  smog: faSmog,
  moon: faMoon,
};

function iconFor(slug: string, isDay: boolean) {
  if (slug === 'sun' && !isDay) return faMoon;
  return ICON_MAP[slug] || faCloud;
}

function fmt(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return Number(n).toFixed(digits);
}

export function WeatherWidget({
  variant = 'compact',
  className = '',
  accentColor = '#38BDF8',
  pollMs = 10 * 60 * 1000,
}: {
  variant?: 'compact' | 'rich';
  className?: string;
  accentColor?: string;
  pollMs?: number;
}) {
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const w = await getWeatherTroisRives();
        if (!cancelled) {
          setData(w);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Erreur météo');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  if (loading && !data) {
    return (
      <div className={`flex items-center gap-2 text-white/50 text-xs ${className}`}>
        <FontAwesomeIcon icon={faCircleNotch} className="animate-spin" />
        <span>Météo…</span>
      </div>
    );
  }

  if (error && !data) {
    return <div className={`text-red-300/80 text-xs ${className}`}>Météo : {error}</div>;
  }
  if (!data) return null;

  const { current, location, forecast } = data;
  const Icon = iconFor(current.iconSlug, current.isDay);

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur ${className}`}
        title={`${location.label} · ${current.weatherLabel}`}
      >
        <FontAwesomeIcon icon={Icon} style={{ color: accentColor }} className="text-sm" />
        <span className="font-semibold tabular-nums text-sm">{fmt(current.tempC, 0)}°C</span>
        <span className="text-white/50 text-xs hidden sm:inline">{current.weatherLabel}</span>
      </div>
    );
  }

  // Rich
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/40">{location.label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl sm:text-5xl font-bold tabular-nums" style={{ color: accentColor }}>
              {fmt(current.tempC, 0)}°
            </span>
            <span className="text-white/60 text-sm">C</span>
          </div>
          <p className="text-white/70 text-sm mt-0.5">{current.weatherLabel}</p>
          <p className="text-white/40 text-xs mt-0.5">Ressenti {fmt(current.feelsLikeC, 0)}°C</p>
        </div>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
        >
          <FontAwesomeIcon icon={Icon} style={{ color: accentColor }} className="text-3xl" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
        <div className="flex items-center gap-1.5 text-white/60">
          <FontAwesomeIcon icon={faWind} className="text-[10px]" />
          <span>{fmt(current.windKmh, 0)} km/h</span>
        </div>
        <div className="flex items-center gap-1.5 text-white/60">
          <FontAwesomeIcon icon={faDroplet} className="text-[10px]" />
          <span>{fmt(current.humidity, 0)}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-white/60 justify-end">
          <FontAwesomeIcon icon={faTemperatureHalf} className="text-[10px]" />
          <span>{fmt(current.feelsLikeC, 0)}°</span>
        </div>
      </div>

      {forecast && forecast.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Prochaines heures</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {forecast.slice(0, 12).map((h) => {
              const d = new Date(h.time);
              const hh = String(d.getHours()).padStart(2, '0');
              const HourIcon = iconFor(h.iconSlug, d.getHours() >= 7 && d.getHours() < 20);
              return (
                <div
                  key={h.time}
                  className="flex-shrink-0 flex flex-col items-center gap-1 px-2 py-2 rounded-lg bg-white/3 border border-white/5 min-w-[52px]"
                >
                  <span className="text-[10px] text-white/50">{hh}h</span>
                  <FontAwesomeIcon icon={HourIcon} className="text-white/80 text-sm" />
                  <span className="text-xs font-medium tabular-nums">{fmt(h.tempC, 0)}°</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
