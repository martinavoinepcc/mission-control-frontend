// Helpers de redimensionnement + compression côté client.
// Toutes les images (avatars + pièces jointes) passent par là avant d'être envoyées au backend.

export type CompressOptions = {
  maxDim?: number;     // plus grand côté (default 1200)
  maxBytes?: number;   // budget data URL (default 300 KB)
  mime?: 'image/webp' | 'image/jpeg'; // webp par défaut (meilleur ratio)
  qualityStart?: number; // qualité initiale (default 0.82)
};

export type CompressedImage = {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;       // taille du data URL
  mime: string;
  qualityUsed: number;
};

// Charge un File en HTMLImageElement (respect de l'orientation EXIF via createImageBitmap si dispo)
async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  // createImageBitmap avec imageOrientation:'from-image' respecte l'EXIF — essentiel pour photo iPhone
  if (typeof (self as any).createImageBitmap === 'function') {
    try {
      const bmp = await (self as any).createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        width: bmp.width,
        height: bmp.height,
        draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
      };
    } catch {
      // fallback ci-dessous
    }
  }
  // Fallback via <img> (peut perdre l'orientation EXIF sur vieux navigateurs)
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<CompressedImage> {
  const maxDim = opts.maxDim ?? 1200;
  const maxBytes = opts.maxBytes ?? 300 * 1024;
  const mime = opts.mime ?? 'image/webp';
  let quality = opts.qualityStart ?? 0.82;

  const src = await loadBitmap(file);
  const scale = Math.min(maxDim / src.width, maxDim / src.height, 1);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponible.');
  // Fond noir pour les webp sur fond transparent (surtout pas pour avatars — callers peuvent override)
  src.draw(ctx, w, h);

  let dataUrl = canvas.toDataURL(mime, quality);
  // Boucle de réduction qualité si trop gros (tente 3 fois jusqu'à 0.5)
  for (let i = 0; i < 4 && dataUrl.length > maxBytes && quality > 0.45; i += 1) {
    quality = Math.max(0.45, quality - 0.12);
    dataUrl = canvas.toDataURL(mime, quality);
  }

  return {
    dataUrl,
    width: w,
    height: h,
    bytes: dataUrl.length,
    mime,
    qualityUsed: quality,
  };
}

// Spécialisation pour avatar : carré centré, 256×256, webp haute qualité.
export async function compressAvatar(file: File): Promise<CompressedImage> {
  const SIZE = 256;
  const src = await loadBitmap(file);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponible.');

  // Crop centré vers carré
  const min = Math.min(src.width, src.height);
  const sx = (src.width - min) / 2;
  const sy = (src.height - min) / 2;

  // createImageBitmap.draw ne supporte pas sx/sy. On passe par un canvas intermédiaire si besoin.
  const tmp = document.createElement('canvas');
  tmp.width = src.width;
  tmp.height = src.height;
  const tctx = tmp.getContext('2d');
  if (!tctx) throw new Error('Canvas 2D tmp non disponible.');
  src.draw(tctx, src.width, src.height);
  ctx.drawImage(tmp, sx, sy, min, min, 0, 0, SIZE, SIZE);

  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/webp', quality);
  // Cible ~25 KB
  for (let i = 0; i < 4 && dataUrl.length > 40 * 1024 && quality > 0.5; i += 1) {
    quality = Math.max(0.5, quality - 0.12);
    dataUrl = canvas.toDataURL('image/webp', quality);
  }

  return {
    dataUrl,
    width: SIZE,
    height: SIZE,
    bytes: dataUrl.length,
    mime: 'image/webp',
    qualityUsed: quality,
  };
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
