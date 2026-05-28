import { useEffect, useState } from 'react';

// Hook live qui detecte si l'user est sur un device mobile (touch sans hover).
// Reagit aux changements (ex: iPad qui branche/debranche un clavier physique).
// Remplace l'ancien detectMobile() one-shot au mount.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
      return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    try {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } catch {
      // Safari < 14 fallback
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, []);
  return isMobile;
}
