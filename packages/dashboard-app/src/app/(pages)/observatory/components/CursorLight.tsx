'use client';

import { useEffect, useRef } from 'react';
import { cursorRef } from '../hooks/useCursor';

export default function CursorLight() {
  const spotRef  = useRef<HTMLDivElement>(null);
  const coreRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    const SIZE = 450;
    const loop = () => {
      const c = cursorRef.current;
      const base = 0.15;
      const boost = Math.min(c.speed * 0.003, 0.1);
      const intensity = base + boost;

      if (spotRef.current) {
        spotRef.current.style.left = `${c.x - SIZE / 2}px`;
        spotRef.current.style.top  = `${c.y - SIZE / 2}px`;
        spotRef.current.style.background = `radial-gradient(circle,
          rgba(73,164,216,${intensity}) 0%,
          rgba(73,164,216,${intensity * 0.3}) 30%,
          transparent 60%)`;
      }
      if (coreRef.current) {
        coreRef.current.style.left = `${c.x - 80}px`;
        coreRef.current.style.top  = `${c.y - 80}px`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div ref={spotRef} style={{
        position: 'fixed', width: 450, height: 450,
        borderRadius: '50%', pointerEvents: 'none',
        zIndex: 1, willChange: 'left, top', mixBlendMode: 'screen',
      }} />
      <div ref={coreRef} style={{
        position: 'fixed', width: 160, height: 160,
        borderRadius: '50%', pointerEvents: 'none',
        zIndex: 1, willChange: 'left, top', mixBlendMode: 'screen',
        background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 50%)',
      }} />
    </>
  );
}
