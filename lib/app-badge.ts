// Helpers pour l'API Badging — pastille de notification sur l'icône PWA (iPhone home screen,
// macOS dock, Chrome desktop shelf). Supporté sur :
//   - iOS 16.4+ (PWA installée à l'écran d'accueil uniquement)
//   - macOS Safari 16.4+ / Chrome / Edge
//   - Android Chrome
// Silent no-op ailleurs.

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function setAppBadge(count: number): void {
  if (typeof navigator === 'undefined') return;
  const n = navigator as NavigatorWithBadge;
  try {
    if (count > 0 && typeof n.setAppBadge === 'function') {
      // Si count > 99, la plupart des OS clampent automatiquement
      n.setAppBadge(count).catch(() => {});
    } else if (typeof n.clearAppBadge === 'function') {
      n.clearAppBadge().catch(() => {});
    }
  } catch {
    /* silencieux */
  }
}

export function clearAppBadge(): void {
  if (typeof navigator === 'undefined') return;
  const n = navigator as NavigatorWithBadge;
  try {
    if (typeof n.clearAppBadge === 'function') {
      n.clearAppBadge().catch(() => {});
    }
  } catch {
    /* silencieux */
  }
}

export function isAppBadgeSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as NavigatorWithBadge).setAppBadge === 'function';
}
