'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { cursorRef } from '../hooks/useCursor';
import type { ObservatoryState } from '../state-machine';

interface Props {
  state: ObservatoryState;
}

const STATE_CONFIG: Record<ObservatoryState, { scale: number; glow: number; pulse: number }> = {
  IDLE:                      { scale: 1,    glow: 0.22, pulse: 0.015 },
  QUERY_RECEIVED:            { scale: 1.15, glow: 0.30, pulse: 0.025 },
  ANALYZING:                 { scale: 1.25, glow: 0.35, pulse: 0.035 },
  FETCHING_DATA:             { scale: 1.35, glow: 0.40, pulse: 0.045 },
  GENERATING_VISUALIZATIONS: { scale: 1.5,  glow: 0.50, pulse: 0.060 },
  REVEAL:                    { scale: 1.8,  glow: 0.60, pulse: 0.080 },
  PRESENTATION:              { scale: 0.4,  glow: 0.10, pulse: 0.010 },
};

export default function CoreLight({ state }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef     = useRef<HTMLDivElement>(null);
  const hoverGlowRef = useRef<HTMLDivElement>(null);
  const frameRef     = useRef(0);
  const baseScale    = useRef(STATE_CONFIG[state].scale);

  // State-driven scale
  useEffect(() => {
    const cfg = STATE_CONFIG[state];
    baseScale.current = cfg.scale;
    gsap.to(containerRef.current, {
      scale:   cfg.scale,
      opacity: state === 'PRESENTATION' ? 0 : 1,
      duration: 0.8,
      ease: 'power3.out',
    });
  }, [state]);

  // Breathing — reads cursorRef directly, no prop dependency
  useEffect(() => {
    let raf: number;
    const animate = () => {
      frameRef.current++;
      const cfg = STATE_CONFIG[state];
      const t = frameRef.current * cfg.pulse;
      if (innerRef.current) {
        const breathe = 1 + Math.sin(t) * 0.12;
        const cursorInfluence = 1 + cursorRef.current.speed * 0.003;
        innerRef.current.style.transform = `scale(${breathe * cursorInfluence})`;
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const cfg = STATE_CONFIG[state];

  const handleMouseEnter = () => {
    gsap.to(containerRef.current, { scale: baseScale.current * 1.2, duration: 0.7, ease: 'power2.inOut', overwrite: true });
    gsap.to(hoverGlowRef.current, { opacity: 1, scale: 1.4, duration: 0.7, ease: 'power2.inOut' });
    gsap.to(innerRef.current,     { boxShadow: '0 0 50px rgba(120,160,255,1), 0 0 100px rgba(80,120,255,0.65)', duration: 0.6, ease: 'power2.inOut' });
  };

  const handleMouseLeave = () => {
    gsap.to(containerRef.current, { scale: baseScale.current, duration: 0.8, ease: 'power2.inOut', overwrite: true });
    gsap.to(hoverGlowRef.current, { opacity: 0, scale: 1, duration: 0.8, ease: 'power2.inOut' });
    gsap.to(innerRef.current,     { boxShadow: '0 0 20px rgba(100,140,255,0.9), 0 0 40px rgba(80,120,255,0.5)', duration: 0.7, ease: 'power2.inOut' });
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          width: 100 + i * 50, height: 100 + i * 50,
          borderRadius: '50%',
          border: '1px solid rgba(100,140,255,0.6)',
          opacity: 0.18 - i * 0.04,
          animation: `coreSpin ${15 + i * 8}s linear infinite ${i % 2 ? 'reverse' : ''}`,
        }} />
      ))}

      <div style={{
        position: 'absolute', width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(80,120,255,0.18) 0%, transparent 70%)',
        filter: 'blur(25px)', opacity: cfg.glow * 0.7,
      }} />

      <div ref={hoverGlowRef} style={{
        position: 'absolute', width: 260, height: 260, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(120,160,255,0.28) 0%, rgba(80,100,255,0.12) 40%, transparent 70%)',
        filter: 'blur(30px)', opacity: 0, pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute', width: 110, height: 110, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(100,140,255,0.5) 0%, transparent 60%)',
        filter: 'blur(12px)', opacity: cfg.glow * 0.35,
      }} />

      <div ref={innerRef} style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'radial-gradient(circle, #fff 0%, rgba(120,160,255,1) 40%, transparent 100%)',
        boxShadow: '0 0 20px rgba(100,140,255,0.9), 0 0 40px rgba(80,120,255,0.5)',
        opacity: 0.9,
      }} />

      <style>{`
        @keyframes coreSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
