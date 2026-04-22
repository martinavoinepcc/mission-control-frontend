'use client';

// Crop tool pour avatar. L'utilisateur pan + zoom avant upload au lieu d'un auto-center.
// Sortie : data URL 256×256 webp compressé <100 KB (multi-pass quality reduction).

import { useEffect, useRef, useState, useCallback } from 'react';

export type CropResult = {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
};

type PinchState = { d0: number; s0: number; cx: number; cy: number; tx0: number; ty0: number };

export default function AvatarCropModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (r: CropResult) => void | Promise<void>;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [containerW, setContainerW] = useState(320);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [maxScale, setMaxScale] = useState(4);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [working, setWorking] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<null | { sx: number; sy: number; tx0: number; ty0: number }>(null);
  const pinchRef = useRef<null | PinchState>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Mesure le container réel (contraint par max-w-md)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Charge l'image
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => setImg(el);
    el.onerror = () => {
      /* noop — si erreur, on laisse l'utilisateur annuler */
    };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Calcule min scale quand containerW ou img change (l'image doit couvrir la zone de crop)
  useEffect(() => {
    if (!img || !containerW) return;
    const minS = Math.max(containerW / img.width, containerW / img.height);
    setMinScale(minS);
    setMaxScale(minS * 4);
    setScale((s) => Math.max(s, minS));
  }, [img, containerW]);

  const clampTx = useCallback(
    (v: number, useScale = scale) => {
      if (!img) return v;
      const maxT = Math.max(0, (img.width * useScale - containerW) / 2);
      return Math.max(-maxT, Math.min(maxT, v));
    },
    [img, scale, containerW]
  );
  const clampTy = useCallback(
    (v: number, useScale = scale) => {
      if (!img) return v;
      const maxT = Math.max(0, (img.height * useScale - containerW) / 2);
      return Math.max(-maxT, Math.min(maxT, v));
    },
    [img, scale, containerW]
  );

  // --- Pointer handlers (mouse + touch unifié) ---

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      // Bascule en mode pinch
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchRef.current = {
        d0: Math.hypot(dx, dy) || 1,
        s0: scale,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
        tx0: tx,
        ty0: ty,
      };
      dragRef.current = null;
    } else {
      dragRef.current = { sx: e.clientX, sy: e.clientY, tx0: tx, ty0: ty };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchRef.current && pointersRef.current.size >= 2) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const d = Math.hypot(dx, dy) || 1;
      const newS = Math.max(minScale, Math.min(maxScale, pinchRef.current.s0 * (d / pinchRef.current.d0)));
      setScale(newS);
      setTx((t) => clampTx(t, newS));
      setTy((t) => clampTy(t, newS));
      return;
    }

    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      setTx(clampTx(dragRef.current.tx0 + dx));
      setTy(clampTy(dragRef.current.ty0 + dy));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  }

  async function confirm() {
    if (!img || working) return;
    setWorking(true);
    try {
      const OUT = 256;
      const crop = containerW;
      // Calcul de la région source dans les coordonnées de l'image d'origine.
      // En display, l'image est centrée + translatée (tx,ty) et zoomée (scale).
      // Le haut-gauche du crop (0,0 display) correspond en image à :
      //   sx = img.width/2 - crop/(2*scale) - tx/scale
      const sx = img.width / 2 - crop / (2 * scale) - tx / scale;
      const sy = img.height / 2 - crop / (2 * scale) - ty / scale;
      const sw = crop / scale;
      const sh = crop / scale;

      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D non disponible.');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT, OUT);

      // On utilise JPEG (pas webp) pour compat max : les notifications push iOS rendent
      // l'icon JPEG/PNG systématiquement, webp est parfois ignoré côté Apple Push Service.
      // JPEG 0.85 pour 256×256 ≈ 25-40 KB, largement sous la limite 120 KB backend.
      let q = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', q);
      for (let i = 0; i < 4 && dataUrl.length > 30 * 1024 && q > 0.55; i += 1) {
        q = Math.max(0.55, q - 0.1);
        dataUrl = canvas.toDataURL('image/jpeg', q);
      }
      // Fallback : réduire la dimension si quality=0.55 insuffisant
      if (dataUrl.length > 100 * 1024) {
        for (const smaller of [200, 160, 128]) {
          const c2 = document.createElement('canvas');
          c2.width = smaller;
          c2.height = smaller;
          const ctx2 = c2.getContext('2d');
          if (!ctx2) continue;
          ctx2.drawImage(img, sx, sy, sw, sh, 0, 0, smaller, smaller);
          const d = c2.toDataURL('image/jpeg', 0.72);
          if (d.length < dataUrl.length) dataUrl = d;
          if (dataUrl.length <= 100 * 1024) break;
        }
      }

      await onConfirm({
        dataUrl,
        bytes: dataUrl.length,
        width: OUT,
        height: OUT,
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingTop: 'max(0px, env(safe-area-inset-top))',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-sky-300">Photo de profil</p>
            <h2 className="text-base font-semibold text-white">Ajuster le cadrage</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={working}
            aria-label="Annuler"
            className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-60"
          >
            ✕
          </button>
        </div>

        {/* Zone de crop — carrée */}
        <div
          ref={containerRef}
          className="relative aspect-square w-full select-none overflow-hidden bg-black"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: 'none', cursor: 'grab' }}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2"
              style={{
                width: img.width * scale,
                height: img.height * scale,
                transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`,
                maxWidth: 'none',
              }}
            />
          )}

          {/* Overlay : assombrit hors cercle + cercle guide bleu */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <mask id="mc-avatar-mask">
                <rect width="100" height="100" fill="white" />
                <circle cx="50" cy="50" r="48" fill="black" />
              </mask>
            </defs>
            <rect width="100" height="100" fill="rgba(0,0,0,0.55)" mask="url(#mc-avatar-mask)" />
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="#29D0FE"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {/* Zoom slider */}
        <div className="border-t border-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">–</span>
            <input
              type="range"
              min={minScale}
              max={maxScale}
              step={0.01}
              value={scale}
              onChange={(e) => {
                const newS = parseFloat(e.target.value);
                setScale(newS);
                setTx(clampTx(tx, newS));
                setTy(clampTy(ty, newS));
              }}
              className="flex-1 accent-sky-500"
            />
            <span className="text-xs text-slate-400">+</span>
          </div>
          <p className="mt-1 text-center text-[10px] text-slate-500">
            Glisse pour repositionner · pince ou curseur pour zoomer
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-white/5 px-4 py-3">
          <button
            onClick={onCancel}
            disabled={working}
            className="flex-1 rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            onClick={confirm}
            disabled={working || !img}
            className="flex-1 rounded-xl bg-sky-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
          >
            {working ? 'Préparation…' : 'Utiliser cette photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
