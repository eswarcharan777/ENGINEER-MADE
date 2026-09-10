import { useEffect } from 'react';

/** A light visual companion to the system pointer for the learner workspace. */
export default function KingdomCursor() {
  useEffect(() => {
    const updatePosition = (event: PointerEvent) => {
      document.documentElement.style.setProperty('--ek-cursor-x', `${event.clientX}px`);
      document.documentElement.style.setProperty('--ek-cursor-y', `${event.clientY}px`);
    };

    window.addEventListener('pointermove', updatePosition, { passive: true });
    return () => window.removeEventListener('pointermove', updatePosition);
  }, []);

  return <span className="kingdom-cursor-glow" aria-hidden="true" />;
}
