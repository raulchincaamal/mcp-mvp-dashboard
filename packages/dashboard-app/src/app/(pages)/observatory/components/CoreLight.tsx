'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { CursorState } from '../hooks/useCursor';
import type { ObservatoryState } from '../state-machine';

interface Props {
  cursor: CursorState;
  state: ObservatoryState;
}

const STATE_CONFIG: Record<ObservatoryState, { scale: number; glow: number; pulse: number }> = {
  IDLE: { scale: 1, glow: 0.3, pulse: 0.015 },
  QUERY_RECEIVED: { scale: 1.2, glow: 0.45, pulse: 0.025 },
  ANALYZING: { scale: 1.35, glow: 0.55, pulse: 0.035 },
  FETCHING_DATA: { scale: 1.5, glow: 0.65, pulse: 0.045 },
  GENERATING_VISUALIZATIONS: { scale: 1.7, glow: 0.8, pulse: 0.06 },
  REVEAL: { scale: 2.2, glow: 1, pulse: 0.08 },
  PRESENTATION: { scale: 0.4, glow: 0.1, pulse: 0.01 },
};

export default function CoreLight({ cursor, state }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const cfg = STATE_CONFIG[state];
    if (!containerRef.current) return;

    gsap.to(containerRef.current, {
      scale: cfg.scale,
      opacity: state === 'PRESENTATION' ? 0 : 1,
      duration: 0.8,
      ease: 'power3.out',
    });
  }, [state]);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      frameRef.current++;
      const cfg = STATE_CONFIG[state];
      const t = frameRef.current * cfg.pulse;

      if (innerRef.current) {
        const breathe = 1 + Math.sin(t) * 0.12;
        const cursorInfluence = 1 + cursor.speed * 0.003;
        innerRef.current.style.transform = `scale(${breathe * cursorInfluence})`;
      }

      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, [state, cursor.speed]);

  const cfg = STATE_CONFIG[state];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: 160,
        height: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Outer glow rings */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="core-ring"
          style={{
            position: 'absolute',
            width: 100 + i * 50,
            height: 100 + i * 50,
            borderRadius: '50%',
            border: '1px solid var(--primary)',
            opacity: 0.2 - i * 0.05,
            animation: `spin ${15 + i * 8}s linear infinite ${i % 2 ? 'reverse' : ''}`,
          }}
        />
      ))}

      {/* Large outer glow */}
      <div
        style={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: `radial-gradient(circle, var(--primary-light) 0%, transparent 70%)`,
          filter: 'blur(30px)',
          opacity: cfg.glow,
        }}
      />

      {/* Medium glow */}
      <div
        style={{
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: `radial-gradient(circle, var(--primary) 0%, transparent 60%)`,
          filter: 'blur(15px)',
          opacity: cfg.glow * 0.5,
        }}
      />

      {/* Inner bright core */}
      <div
        ref={innerRef}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: `radial-gradient(circle, 
            var(--text) 0%, 
            var(--primary) 40%, 
            transparent 100%)`,
          boxShadow: `0 0 30px var(--primary), 0 0 60px var(--primary-light)`,
          opacity: 0.9,
        }}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
