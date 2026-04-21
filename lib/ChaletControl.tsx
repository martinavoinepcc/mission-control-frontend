'use client';

// ChaletControl — nouvelle UI de contrôle chalet (v2, round 1).
//
// Stack :
//  - Dials ronds SVG pour chaque thermostat + dial "Général" (moyenne + push global)
//  - Barre de presets (Confort / Éco / Soirée / Absence horaire)
//  - Météo Trois-Rives (rich) — Open-Meteo proxy backend
//  - Data panel mini-graphe 24h (historique stub ou réel)
//  - Iframe Hubitat déployable en bas "Vue Hubitat classique" (fallback tant que Maker
//    API pas câblé, ou pour opérations avancées)
//
// Mode STUB (par défaut, tant que HUBITAT_MAKER_TOKEN pas set en env backend) :
//  - 2 thermostats simulés qui drift vers leur setpoint
//  - Presets modifient les setpoints du stub
//  - Data panel affiche courbe synthétique plausible
//  - Un badge "Simulation" est visible pour être transparent
//
// Mode LIVE (une fois Maker API activé + env vars Render set) :
//  - Même UI, mais pousse vraiment dans Hubitat
//  - Maison peut migrer vers cette UI après validation chalet.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faMountainSun,
  faHouse,
  faArrowsRotate,
  faCircleNotch,
  faPlane,
  faMoon,
  faFire,
  faLeaf,
  faChevronDown,
  faChevronUp,
  faFlask,
  faWandMagicSparkles,
  faClock,
  faXmark,
  faCheck,
  faUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons';

import { ThermostatDial } from '@/components/ThermostatDial';
import { WeatherWidget } from '@/components/WeatherWidget';
import {
  getHubitatDevices,
  setHubitatSetpoint,
  applyHubitatPreset,
  getHubitatHistory,
  type HubitatDevice,
  type ActivePreset,
  type HubitatHistoryPoint,
  type HubitatLocation,
} from '@/lib/hubitat-api';

type Preset = {
  slug: 'confort' | 'eco' | 'soiree' | 'away-horaire';
  label: string;
  icon: any;
  color: string;
  target: number;
  description: string;
  needsReturn?: boolean;
};

const PRESETS: Preset[] = [
  { slug: 'confort', label: 'Confort', icon: faFire, color: '#F97316', target: 21, description: 'Pousse tout à 21 °C.' },
  { slug: 'eco', label: 'Éco', icon: faLeaf, color: '#34D399', target: 17, description: 'Baisse à 17 °C pour économiser.' },
  { slug: 'soiree', label: 'Soirée', icon: faMoon, color: '#A78BFA', target: 20, description: 'Ambiance soirée, 20 °C stable.' },
  {
    slug: 'away-horaire',
    label: 'Absence horaire',
    icon: faPlane,
    color: '#94A3B8',
    target: 14,
    description: 'Setback 14 °C, relance programmée au retour.',
    needsReturn: true,
  },
];

export type ChaletControlProps = {
  location?: HubitatLocation; // defaults CHALET
  title?: string;
  subtitle?: string;
  accentColor?: string;
  hubitatDashboardUrl?: string; // URL iframe fallback
};

export function ChaletControl({
  location = 'CHALET',
  title = 'Contrôle Chalet',
  subtitle = 'Thermostats, presets et météo · Lac Mékinac',
  accentColor = '#F59E0B',
  hubitatDashboardUrl,
}: ChaletControlProps) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState<'STUB' | 'LIVE' | null>(null);
  const [devices, setDevices] = useState<HubitatDevice[]>([]);
  const [activePreset, setActivePreset] = useState<ActivePreset>(null);
  const [history, setHistory] = useState<HubitatHistoryPoint[]>([]);
  const [historySynthetic, setHistorySynthetic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [showHubitatFrame, setShowHubitatFrame] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const [pendingPreset, setPendingPreset] = useState<Preset | null>(null);
  const [pendingReturnAt, setPendingReturnAt] = useState<string>('');
  const [toast, setToast] = useState<{ kind: 'info' | 'ok' | 'err'; text: string } | null>(null);

  // Auth guard
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('mc_token')) {
      router.push('/');
      return;
    }
    setAuthReady(true);
  }, [router]);

  // Poll devices
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    async function load() {
      try {
        const r = await getHubitatDevices(location);
        if (cancelled) return;
        setMode(r.mode);
        setDevices(r.devices);
        setActivePreset(r.activePreset);
      } catch (e: any) {
        if (!cancelled) setToast({ kind: 'err', text: e.message || 'Erreur Hubitat' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authReady, location, refreshTick]);

  // Load history
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    getHubitatHistory(location, 24)
      .then((r) => {
        if (!cancelled) {
          setHistory(r.points);
          setHistorySynthetic(Boolean(r.synthetic));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authReady, location, refreshTick]);

  const avgCurrent = useMemo(() => {
    const vals = devices.map((d) => d.currentTemp).filter((v): v is number => typeof v === 'number');
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [devices]);

  const avgSetpoint = useMemo(() => {
    const vals = devices.map((d) => d.setpoint).filter((v): v is number => typeof v === 'number');
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [devices]);

  const generalOpState = useMemo(() => {
    if (devices.some((d) => /heat/i.test(d.operatingState))) return 'heating';
    if (devices.some((d) => /cool/i.test(d.operatingState))) return 'cooling';
    return 'idle';
  }, [devices]);

  async function handleSetpoint(device: HubitatDevice, value: number) {
    try {
      const r = await setHubitatSetpoint(device.hubitatId, location, value);
      setDevices((prev) =>
        prev.map((d) => (d.hubitatId === device.hubitatId ? { ...d, setpoint: value } : d))
      );
      setToast({ kind: 'ok', text: `${device.label} : consigne ${value}°C` });
    } catch (e: any) {
      setToast({ kind: 'err', text: e.message || 'Erreur consigne' });
    }
  }

  async function handleGeneralSetpoint(value: number) {
    try {
      await Promise.all(
        devices.map((d) => setHubitatSetpoint(d.hubitatId, location, value))
      );
      setDevices((prev) => prev.map((d) => ({ ...d, setpoint: value })));
      setToast({ kind: 'ok', text: `Consigne générale ${value}°C` });
    } catch (e: any) {
      setToast({ kind: 'err', text: e.message || 'Erreur consigne générale' });
    }
  }

  async function confirmPreset(preset: Preset, returnAt?: string | null) {
    try {
      const r = await applyHubitatPreset(preset.slug, location, returnAt || null);
      setToast({
        kind: 'ok',
        text: returnAt
          ? `${preset.label} appliqué · retour ${new Date(returnAt).toLocaleString('fr-CA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`
          : `${preset.label} appliqué`,
      });
      if (r.devices) setDevices(r.devices);
      if (r.applied && typeof r.applied === 'object') setActivePreset(r.applied);
      else if (!returnAt) setActivePreset(null);
      setPendingPreset(null);
      setPendingReturnAt('');
      setRefreshTick((t) => t + 1);
    } catch (e: any) {
      setToast({ kind: 'err', text: e.message || 'Erreur preset' });
    }
  }

  function onPresetClick(preset: Preset) {
    if (preset.needsReturn) {
      const d = new Date();
      d.setHours(d.getHours() + 3);
      const iso = d.toISOString().slice(0, 16);
      setPendingReturnAt(iso);
      setPendingPreset(preset);
    } else {
      confirmPreset(preset);
    }
  }

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const locationIcon = location === 'CHALET' ? faMountainSun : faHouse;

  if (!authReady || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
        <FontAwesomeIcon icon={faCircleNotch} className="text-3xl animate-spin" style={{ color: accentColor }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a14] text-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-3 sm:px-5 py-3 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-white/70 hover:text-white transition flex items-center gap-2 text-sm touch-manipulation"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
            <span className="hidden sm:inline">Retour</span>
          </button>
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}50` }}
            >
              <FontAwesomeIcon icon={locationIcon} style={{ color: accentColor }} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-semibold text-sm sm:text-base truncate">{title}</div>
              <div className="text-white/50 text-[10px] sm:text-xs truncate">{subtitle}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'STUB' && (
            <div
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-wider"
              style={{ borderColor: '#A78BFA55', background: '#A78BFA15', color: '#DDD6FE' }}
              title="Mode simulation — Maker API Hubitat pas encore câblé"
            >
              <FontAwesomeIcon icon={faFlask} className="text-[9px]" />
              <span>Simulation</span>
            </div>
          )}
          <WeatherWidget variant="compact" accentColor={accentColor} />
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            className="w-9 h-9 rounded-lg border border-white/15 hover:bg-white/5 flex items-center justify-center touch-manipulation"
            aria-label="Rafraîchir"
            title="Rafraîchir"
          >
            <FontAwesomeIcon icon={faArrowsRotate} className="text-xs" />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Bandeau preset actif */}
        {activePreset && (
          <div
            className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-3"
            style={{ borderColor: accentColor + '55', background: accentColor + '12' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: accentColor }} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">Preset actif : {activePreset.label}</div>
                {activePreset.scheduledReturnAt && (
                  <div className="text-[11px] text-white/60 flex items-center gap-1">
                    <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                    Retour programmé :{' '}
                    {new Date(activePreset.scheduledReturnAt).toLocaleString('fr-CA', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dial général + dials individuels */}
        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Thermostats</p>
            <p className="text-[10px] text-white/40">{devices.length} actif{devices.length > 1 ? 's' : ''}</p>
          </div>
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-8">
            <div className="flex-shrink-0">
              <ThermostatDial
                label="Général"
                sublabel="Moyenne · push sur tous"
                currentTemp={avgCurrent}
                setpoint={avgSetpoint}
                operatingState={generalOpState}
                size={260}
                accentColor={accentColor}
                onSetpointChange={(v) => handleGeneralSetpoint(v)}
              />
            </div>
            <div className="flex-1 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {devices.map((d) => (
                  <div key={d.hubitatId} className="rounded-xl border border-white/5 bg-white/3 p-3 flex justify-center">
                    <ThermostatDial
                      label={d.label}
                      sublabel={d.room && d.room !== d.label ? d.room : undefined}
                      currentTemp={d.currentTemp}
                      setpoint={d.setpoint}
                      operatingState={d.operatingState}
                      size={200}
                      accentColor={accentColor}
                      onSetpointChange={(v) => handleSetpoint(d, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Presets */}
        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Presets rapides</p>
            <p className="text-[10px] text-white/40">Tap pour appliquer</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PRESETS.map((p) => {
              const active = activePreset?.slug === p.slug;
              return (
                <button
                  key={p.slug}
                  onClick={() => onPresetClick(p)}
                  className={`group relative rounded-2xl border p-4 text-left transition touch-manipulation ${
                    active ? 'ring-2' : 'hover:bg-white/5'
                  }`}
                  style={{
                    borderColor: active ? p.color : 'rgba(255,255,255,0.12)',
                    background: active ? p.color + '15' : 'rgba(255,255,255,0.03)',
                    // @ts-ignore – custom prop for ring color via Tailwind ring utility fallback
                    boxShadow: active ? `0 0 0 2px ${p.color}88` : undefined,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                    style={{ background: p.color + '20', border: `1px solid ${p.color}55` }}
                  >
                    <FontAwesomeIcon icon={p.icon} style={{ color: p.color }} />
                  </div>
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-[11px] text-white/60 mt-0.5">{p.description}</div>
                  <div className="text-[10px] text-white/40 mt-2 tabular-nums">Cible : {p.target}°C</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Météo rich */}
        <WeatherWidget variant="rich" accentColor={accentColor} />

        {/* Data panel */}
        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
          <button
            onClick={() => setShowGraph((v) => !v)}
            className="w-full flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Historique 24 h</p>
              {historySynthetic && (
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-200 border border-purple-400/30">
                  Synthétique
                </span>
              )}
            </div>
            <FontAwesomeIcon icon={showGraph ? faChevronUp : faChevronDown} className="text-white/50 text-xs" />
          </button>
          {showGraph && (
            <div className="px-4 sm:px-6 pb-5">
              <HistoryGraph points={history} accentColor={accentColor} />
              <p className="text-[11px] text-white/40 mt-3">
                Fondation pour la future couche AI : on loggera temp int., consigne, état
                heat/idle et temp ext. Claude pourra ensuite répondre à des questions comme
                « combien de temps pour passer de 12 à 20 °C à −15 dehors ? ».
              </p>
            </div>
          )}
        </section>

        {/* Vue Hubitat classique (fallback) */}
        {hubitatDashboardUrl && (
          <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
            <button
              onClick={() => setShowHubitatFrame((v) => !v)}
              className="w-full flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Vue Hubitat classique</p>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-400/30">
                  Fallback
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={hubitatDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-white/50 hover:text-white text-xs flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faUpRightFromSquare} className="text-[10px]" />
                  <span className="hidden sm:inline">Nouvel onglet</span>
                </a>
                <FontAwesomeIcon icon={showHubitatFrame ? faChevronUp : faChevronDown} className="text-white/50 text-xs" />
              </div>
            </button>
            {showHubitatFrame && (
              <div className="h-[600px] border-t border-white/10">
                <iframe
                  src={hubitatDashboardUrl}
                  className="w-full h-full"
                  allow="fullscreen"
                  title="Hubitat dashboard"
                />
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modal preset avec return (Absence horaire) */}
      {pendingPreset && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121f] p-5">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: pendingPreset.color + '20', border: `1px solid ${pendingPreset.color}55` }}
              >
                <FontAwesomeIcon icon={pendingPreset.icon} style={{ color: pendingPreset.color }} />
              </div>
              <div>
                <div className="font-display font-semibold">{pendingPreset.label}</div>
                <div className="text-xs text-white/50">{pendingPreset.description}</div>
              </div>
            </div>

            <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-2">
              Retour prévu
            </label>
            <input
              type="datetime-local"
              value={pendingReturnAt}
              onChange={(e) => setPendingReturnAt(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
            <p className="text-[11px] text-white/40 mt-2">
              Setback immédiat à {pendingPreset.target} °C. Le retour planifié est enregistré pour la future relance automatique.
            </p>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setPendingPreset(null);
                  setPendingReturnAt('');
                }}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm hover:bg-white/5 flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faXmark} />
                Annuler
              </button>
              <button
                onClick={() => {
                  const iso = pendingReturnAt ? new Date(pendingReturnAt).toISOString() : null;
                  confirmPreset(pendingPreset, iso);
                }}
                className="flex-1 rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: pendingPreset.color, color: '#0a0a14' }}
              >
                <FontAwesomeIcon icon={faCheck} />
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl border backdrop-blur"
          style={{
            borderColor:
              toast.kind === 'ok' ? '#34D39955' : toast.kind === 'err' ? '#F8717155' : '#A78BFA55',
            background:
              toast.kind === 'ok' ? '#34D39915' : toast.kind === 'err' ? '#F8717115' : '#A78BFA15',
            color:
              toast.kind === 'ok' ? '#A7F3D0' : toast.kind === 'err' ? '#FCA5A5' : '#DDD6FE',
          }}
        >
          <span className="text-sm">{toast.text}</span>
        </div>
      )}
    </main>
  );
}

// --- Mini graphe SVG (pas de lib externe) ---

function HistoryGraph({ points, accentColor }: { points: HubitatHistoryPoint[]; accentColor: string }) {
  if (!points.length) {
    return <div className="py-10 text-center text-white/40 text-sm">Aucune donnée encore.</div>;
  }

  const width = 900;
  const height = 180;
  const padX = 30;
  const padY = 20;

  // Regroupe par device
  const byDevice = new Map<string, HubitatHistoryPoint[]>();
  for (const p of points) {
    if (!byDevice.has(p.deviceId)) byDevice.set(p.deviceId, []);
    byDevice.get(p.deviceId)!.push(p);
  }

  const all = [...points];
  const times = all.map((p) => new Date(p.takenAt).getTime());
  const temps = all.map((p) => p.currentTemp).filter((t) => Number.isFinite(t));
  const outs = all.map((p) => p.outdoorTemp).filter((t): t is number => typeof t === 'number');

  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const yMin = Math.min(...temps, ...(outs.length ? outs : [100]));
  const yMax = Math.max(...temps, ...(outs.length ? outs : [-100]));
  const yPad = 2;
  const yLow = Math.floor(yMin - yPad);
  const yHigh = Math.ceil(yMax + yPad);

  function x(t: number) {
    if (tMax === tMin) return padX;
    return padX + ((t - tMin) / (tMax - tMin)) * (width - padX * 2);
  }
  function y(v: number) {
    if (yHigh === yLow) return height / 2;
    return padY + (1 - (v - yLow) / (yHigh - yLow)) * (height - padY * 2);
  }

  const devicePaths: { id: string; d: string }[] = [];
  for (const [id, ps] of byDevice.entries()) {
    const sorted = [...ps].sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
    const d = sorted
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(new Date(p.takenAt).getTime())} ${y(p.currentTemp)}`)
      .join(' ');
    devicePaths.push({ id, d });
  }

  // Outdoor path (une seule courbe, moyenne si plusieurs devices à même takenAt)
  const outdoorByTime = new Map<string, number>();
  for (const p of all) {
    if (typeof p.outdoorTemp === 'number') outdoorByTime.set(p.takenAt, p.outdoorTemp);
  }
  const outdoorPath = [...outdoorByTime.entries()]
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([t, v], i) => `${i === 0 ? 'M' : 'L'} ${x(new Date(t).getTime())} ${y(v)}`)
    .join(' ');

  // Y grid
  const gridLines = [];
  for (let v = yLow; v <= yHigh; v += Math.max(1, Math.round((yHigh - yLow) / 4))) {
    gridLines.push(
      <g key={v}>
        <line x1={padX} y1={y(v)} x2={width - padX} y2={y(v)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        <text x={padX - 4} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="rgba(255,255,255,0.4)">
          {v}°
        </text>
      </g>
    );
  }

  const deviceColors = ['#F59E0B', '#22D3EE', '#A78BFA', '#F472B6', '#34D399'];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px] h-[180px]">
        {gridLines}

        {outdoorPath && (
          <path d={outdoorPath} fill="none" stroke="#64748B" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
        )}

        {devicePaths.map((p, i) => (
          <path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={deviceColors[i % deviceColors.length]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="flex items-center gap-4 text-[10px] text-white/60 mt-2 flex-wrap">
        {devicePaths.map((p, i) => (
          <div key={p.id} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-[2px]"
              style={{ background: deviceColors[i % deviceColors.length] }}
            />
            <span>{p.id.replace(/^stub-(chalet|maison)-/, '')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] border-t border-dashed border-slate-400" />
          <span>Extérieur</span>
        </div>
      </div>
    </div>
  );
}
