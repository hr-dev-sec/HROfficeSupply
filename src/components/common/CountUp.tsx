import React, { useEffect, useState } from 'react';

interface CountUpProps {
  value: number;
  durationMs?: number;
  formatter?: (val: number) => string;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  durationMs = 700,
  formatter = (v) => Math.round(v).toLocaleString('id-ID'),
  className = '',
}) => {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    let frameId = 0;
    const startVal = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(startVal + (value - startVal) * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs]);

  return <span className={`tabular-nums ${className}`}>{formatter(display)}</span>;
};
