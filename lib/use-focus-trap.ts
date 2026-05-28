import { useEffect, RefObject } from 'react';

// Focus trap pour les modales : Tab et Shift+Tab cyclent dans le container.
// Au mount : focus le premier element focusable. Au unmount : restore le focus precedent.
// Usage :
//   const ref = useRef<HTMLDivElement>(null);
//   useFocusTrap(open, ref);
//   <div ref={ref} role="dialog" ...>...</div>
export function useFocusTrap(open: boolean, ref: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const container = ref.current;
    const selectors = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter((el) => !el.hasAttribute('inert') && el.offsetParent !== null);
    const first = focusables()[0];
    const previousActive = document.activeElement as HTMLElement | null;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) { e.preventDefault(); return; }
      const idx = list.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (idx <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
      } else {
        if (idx === list.length - 1 || idx === -1) { e.preventDefault(); list[0].focus(); }
      }
    };
    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      try { previousActive?.focus?.(); } catch { /* noop */ }
    };
  }, [open, ref]);
}
