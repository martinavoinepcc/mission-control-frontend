'use client';

// ThermostatDial — cercle de contrôle thermostat (SVG pur, responsive).
//
// Design :
//  - Arc de fond 270° (gap en bas) entre minTemp et maxTemp
//  - Arc coloré progressif selon la température actuelle
//  - Marqueur setpoint (point coloré sur l'arc)
//  - Centre : temp actuelle (gros), setpoint (petit), opératoire (badge)
//  - Boutons +/- sous le cercle pour ajuster la consigne
//  - Click sur le centre = ouvre callback edit (parent peut afficher un slider)
//
// Un seul dial peut aussi représenter la "temp générale" (moyenne) si deviceLabel="Général"
// et que onSetpointChange pousse la consigne à tous les thermostats.

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faSnowflake, faFan, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';

type Props = {
  label: string;
  sublabel?: string;
  currentTemp: number | null;
  setpoint: number | null;
  operatingState: string; // heating | idle | cooling | fan only
  minTemp?: number;
  maxTemp?: number;
  step?: number;
  size?: number;
  accentColor?: string;
  onSetpointChange?: (newValue: number) => void;
  onPress?: () => void;
  disabled?: boolean;
};

const SWEEP = 270;
const START_ANGLE = 225; // bottom-left, goes clockwise 270° to bottom-right

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const sweep = (endDeg - startDeg + 360) % 360;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function angleForTemp(t: number, min: number, max: number) {
  const frac = Math.max(0, Math.min(1, (t - min) / (max - min)));
  return (START_ANGLE + frac * SWEEP) % 360;
}

function stateColor(state: string, fallback: string) {
  const s = (state || '').toLowerCase();
  if (s.includes('heat')) return '#F97316';
  if (s.includes('cool')) return '#22D3EE';
  if (s.includes('fan')) return '#A78BFA';
  return fallback;
}

function stateLabel(state: string) {
  const s = (state || '').toLowerCase();
  if (s.includes('heat')) return 'Chauffe';
  if (s.includes('cool')) return 'Refroidit';
  if (s.includes('fan')) return 'Ventile';
  return 'Stable';
}

function stateIcon(state: string) {
  const s = (state || '').toLowerCase();
  if (s.includes('heat')) return faFire;
  if (s.includes('cool')) return faSnowflake;
  if (s.includes('fan')) return faFan;
  return faSnowflake;
}

function fmt(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return Number(n).toFixed(digits);
}

export function ThermostatDial({
  label,
  sublabel,
  currentTemp,
  setpoint,
  operatingState,
  minTemp = 10,
  maxTemp = 28,
  step = 0.5,
  size = 220,
  accentColor = '#F59E0B',
  onSetpointChange,
  onPress,
  disabled = false,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;
  const strokeWidth = Math.max(10, Math.round(size / 18));

  const bgEnd = (START_ANGLE + SWEEP) % 360;
  const currAngle = currentTemp !== null ? angleForTemp(currentTemp, minTemp, maxTemp) : START_ANGLE;
  const setAngle = setpoint !== null ? angleForTemp(setpoint, minTemp, maxTemp) : START_ANGLE;

  const arcColor = stateColor(operatingState, accentColor);
  const marker = setpoint !== null ? polarToCartesian(cx, cy, r, setAngle) : null;

  function bump(delta: number) {
    if (!onSetpointChange || setpoint === null) return;
    const next = Math.round((setpoint + delta) / step) * step;
    onSetpointChange(Math.max(minTemp, Math.min(maxTemp, next)));
  }

  return (
    <div className="flex flex-col items-center select-none">
      <div
        role={onPress ? 'button' : undefined}
        tabIndex={onPress ? 0 : undefined}
        onClick={() => onPress?.()}
        onKeyDown={(e) => {
          if (onPress && (e.key === 'Enter' || e.key === ' ')) onPress();
        }}
        className={`relative ${onPress ? 'cursor-pointer' : ''}`}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${fmt(currentTemp, 1)} °C`}>
          {/* Arc fond */}
          <path
            d={arcPath(cx, cy, r, START_ANGLE, bgEnd)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Arc rempli (de min jusqu'à la temp actuelle) */}
          {currentTemp !== null && (
            <path
              d={arcPath(cx, cy, r, START_ANGLE, currAngle)}
              fill="none"
              stroke={arcColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{ transition: 'all 0.6s ease' }}
            />
          )}
          {/* Marqueur setpoint */}
          {marker && (
            <g>
              <circle cx={marker.x} cy={marker.y} r={strokeWidth / 2 + 4} fill="#0a0a14" />
              <circle cx={marker.x} cy={marker.y} r={strokeWidth / 2 + 1} fill={accentColor} />
              <circle cx={marker.x} cy={marker.y} r={strokeWidth / 2 - 3} fill="#0a0a14" />
            </g>
          )}
        </svg>

        {/* Centre */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
          style={{ padding: size * 0.14 }}
        >
          <p className="text-[10px] uppercase tracking-wider text-white/40 leading-none mb-1">{label}</p>
          <div className="flex items-baseline gap-0.5">
            <span className="font-display font-bold tabular-nums leading-none" style={{ fontSize: size * 0.24 }}>
              {fmt(currentTemp, 1)}
            </span>
            <span className="text-white/60" style={{ fontSize: size * 0.08 }}>
              °C
            </span>
          </div>
          {setpoint !== null && (
            <p className="text-white/50 mt-1" style={{ fontSize: size * 0.065 }}>
              Consigne {fmt(setpoint, 1)}°C
            </p>
          )}
          <div
            className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border"
            style={{
              borderColor: arcColor + '55',
              background: arcColor + '15',
              fontSize: size * 0.055,
            }}
          >
            <FontAwesomeIcon icon={stateIcon(operatingState)} style={{ color: arcColor }} className="text-[9px]" />
            <span style={{ color: arcColor }}>{stateLabel(operatingState)}</span>
          </div>
          {sublabel && <p className="text-white/35 text-[10px] mt-1">{sublabel}</p>}
        </div>
      </div>

      {onSetpointChange && setpoint !== null && !disabled && (
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              bump(-step);
            }}
            className="w-10 h-10 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center touch-manipulation transition"
            aria-label="Diminuer la consigne"
          >
            <FontAwesomeIcon icon={faMinus} className="text-white/80 text-sm" />
          </button>
          <div className="text-xs text-white/50 min-w-[42px] text-center tabular-nums">
            {fmt(setpoint, 1)}°C
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              bump(step);
            }}
            className="w-10 h-10 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center touch-manipulation transition"
            aria-label="Augmenter la consigne"
          >
            <FontAwesomeIcon icon={faPlus} className="text-white/80 text-sm" />
          </button>
        </div>
      )}
    </div>
  );
}
