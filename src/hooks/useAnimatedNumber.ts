import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 380;

/**
 * Smoothly interpolates toward `target` when it changes (e.g. totals after add/edit).
 * When `enabled` is false, snaps to `target` (e.g. masked numbers).
 * Skips animation on the first committed value to avoid a flash on load.
 */
export function useAnimatedNumber(target: number, enabled: boolean): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const rafRef = useRef<number>();
  const skipFirstAnimation = useRef(true);

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    if (skipFirstAnimation.current) {
      skipFirstAnimation.current = false;
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const start = displayRef.current;
    const end = target;
    if (Math.abs(end - start) < 0.005) {
      displayRef.current = end;
      setDisplay(end);
      return;
    }

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      const next = start + (end - start) * eased;
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, enabled]);

  return display;
}
