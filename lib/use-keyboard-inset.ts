import { useEffect, useState } from 'react';

// Detecte la hauteur du clavier virtuel (iOS Safari) via visualViewport API.
// Retourne le nombre de px occupes par le clavier (0 si pas de clavier).
// A appliquer en paddingBottom du composer pour eviter qu'il soit clippe.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(offset);
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);
  return inset;
}
