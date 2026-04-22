// Composant Avatar réutilisable : photo si disponible, sinon cercle coloré + initiale.
// Utilise la même palette stable que `avatarColor` dans messagerie-api.

const AVATAR_BG = [
  { bg: 'bg-fuchsia-500', hex: '#EC4899' },
  { bg: 'bg-violet-500',  hex: '#8B5CF6' },
  { bg: 'bg-cyan-500',    hex: '#06B6D4' },
  { bg: 'bg-amber-500',   hex: '#F59E0B' },
  { bg: 'bg-emerald-500', hex: '#10B981' },
  { bg: 'bg-rose-500',    hex: '#F43F5E' },
  { bg: 'bg-sky-500',     hex: '#0EA5E9' },
  { bg: 'bg-indigo-500',  hex: '#6366F1' },
];

export function avatarBg(userId: number): string {
  return AVATAR_BG[Math.abs(userId) % AVATAR_BG.length].bg;
}

function initialOf(firstName: string | null | undefined): string {
  if (!firstName) return '·';
  const t = firstName.trim();
  return t ? t.charAt(0).toUpperCase() : '·';
}

export type AvatarProps = {
  userId: number;
  firstName: string | null;
  src?: string | null;       // data URL base64 — si présent, on l'affiche
  size?: number;             // diamètre px (default 40)
  ring?: boolean;            // ring-2 ring-slate-900 (empilement)
  ringColor?: string;
  className?: string;
};

export default function Avatar({
  userId,
  firstName,
  src,
  size = 40,
  ring = false,
  ringColor,
  className = '',
}: AvatarProps) {
  const bg = avatarBg(userId);
  const ringCls = ring ? 'ring-2' : '';
  const ringStyle = ring
    ? { boxShadow: `0 0 0 2px ${ringColor || '#0f172a'}` }
    : undefined;

  if (src) {
    return (
      <div
        className={`relative flex-shrink-0 overflow-hidden rounded-full ${ringCls} ${className}`}
        style={{
          width: size,
          height: size,
          ...ringStyle,
        }}
        aria-label={firstName || 'Avatar'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={firstName || ''}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={`${bg} flex-shrink-0 text-white rounded-full flex items-center justify-center font-semibold select-none ${ringCls} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(12, Math.floor(size / 2.4)),
        ...ringStyle,
      }}
      aria-label={firstName || 'Avatar'}
      title={firstName || ''}
    >
      {initialOf(firstName)}
    </div>
  );
}
