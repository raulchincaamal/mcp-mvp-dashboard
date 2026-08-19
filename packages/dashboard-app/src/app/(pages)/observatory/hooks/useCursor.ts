'use client';

import { useEffect, useRef, useState } from 'react';

export interface CursorState {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
  velocityX: number;
  velocityY: number;
  speed: number;
  isMoving: boolean;
}

const INITIAL: CursorState = {
  x: 0, y: 0, normalizedX: 0, normalizedY: 0,
  velocityX: 0, velocityY: 0, speed: 0, isMoving: false,
};

export function useCursor() {
  const [cursor, setCursor] = useState<CursorState>(INITIAL);
  const last = useRef({ x: 0, y: 0, t: Date.now() });
  const target = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const raf = useRef<number>(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tick = () => {
    const t = target.current;
    setCursor(p => ({
      x: p.x + (t.x - p.x) * 0.12,
      y: p.y + (t.y - p.y) * 0.12,
      normalizedX: (t.x / window.innerWidth) * 2 - 1,
      normalizedY: (t.y / window.innerHeight) * 2 - 1,
      velocityX: p.velocityX + (t.vx - p.velocityX) * 0.08,
      velocityY: p.velocityY + (t.vy - p.velocityY) * 0.08,
      speed: Math.sqrt(t.vx ** 2 + t.vy ** 2),
      isMoving: p.isMoving,
    }));
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const now = Date.now();
      const dt = Math.max(now - last.current.t, 1);
      target.current = {
        x: e.clientX,
        y: e.clientY,
        vx: (e.clientX - last.current.x) / dt * 16,
        vy: (e.clientY - last.current.y) / dt * 16,
      };
      last.current = { x: e.clientX, y: e.clientY, t: now };
      setCursor(p => ({ ...p, isMoving: true }));
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        setCursor(p => ({ ...p, isMoving: false }));
        target.current.vx = 0;
        target.current.vy = 0;
      }, 80);
    };
    raf.current = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('mousemove', onMove);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  return cursor;
}
