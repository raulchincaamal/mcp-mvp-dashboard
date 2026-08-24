'use client';

import { useEffect, useRef, memo } from 'react';
import { gsap } from 'gsap';
import { cursorRef } from '../hooks/useCursor';
import type { ObservatoryState } from '../state-machine';

interface Props {
  state: ObservatoryState;
  triggered?: boolean;
  onTriggerComplete?: () => void;
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

const CoreLight = memo(function CoreLight({ state, triggered, onTriggerComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef     = useRef<HTMLDivElement>(null);
  const hoverGlowRef = useRef<HTMLDivElement>(null);
  const ripple1Ref   = useRef<HTMLDivElement>(null);
  const ripple2Ref   = useRef<HTMLDivElement>(null);
  const ripple3Ref   = useRef<HTMLDivElement>(null);
  const frameRef     = useRef(0);
  const baseScale    = useRef(STATE_CONFIG[state].scale);
  const stateRef     = useRef(state);

  // iOS-style trigger animation
  useEffect(() => {
    if (!triggered) return;
    const tl = gsap.timeline({ onComplete: onTriggerComplete });
    const ripples = [ripple1Ref.current, ripple2Ref.current, ripple3Ref.current];

    // Reset ripples
    ripples.forEach(r => gsap.set(r, { scale: 0.5, opacity: 0 }));

    // 1. Quick scale-up punch
    tl.to(containerRef.current, { scale: baseScale.current * 1.6, duration: 0.18, ease: 'power3.out' });
    // 2. Ripples expand outward staggered
    tl.to(ripples, { scale: 3.5, opacity: 0, duration: 0.9, ease: 'power2.out', stagger: 0.12 }, '-=0.1');
    // 3. Inner dot flash white
    tl.to(innerRef.current, { boxShadow: '0 0 80px rgba(180,200,255,1), 0 0 160px rgba(120,160,255,0.9)', scale: 1.8, duration: 0.2, ease: 'power2.out' }, '-=0.85');
    // 4. Collapse into zoom
    tl.to(containerRef.current, { scale: 0, duration: 0.35, ease: 'back.in(2)' }, '-=0.3');
  }, [triggered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep stateRef in sync without re-rendering
  useEffect(() => {
    stateRef.current = state;
    const cfg = STATE_CONFIG[state];
    baseScale.current = cfg.scale;
    gsap.to(containerRef.current, {
      scale: cfg.scale,
      opacity: state === 'PRESENTATION' ? 0 : 1,
      duration: 0.8,
      ease: 'power3.out',
    });
  }, [state]);

  // Single persistent RAF — never restarts
  useEffect(() => {
    let raf: number;
    const animate = () => {
      frameRef.current++;
      const cfg = STATE_CONFIG[stateRef.current];
      const t = frameRef.current * cfg.pulse;
      if (innerRef.current) {
        const breathe = 1 + Math.sin(t) * 0.12;
        const cursorInfluence = 1 + Math.min(cursorRef.current.speed * 0.003, 0.08);
        innerRef.current.style.transform = `scale(${breathe * cursorInfluence})`;
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, []); // empty deps — runs once, reads stateRef

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
      {/* Ripples — iOS tap feedback */}
      {[ripple1Ref, ripple2Ref, ripple3Ref].map((ref, i) => (
        <div key={`ripple-${i}`} ref={ref} style={{
          position: 'absolute',
          width: 160, height: 160,
          borderRadius: '50%',
          border: `1.5px solid rgba(${i === 0 ? '180,200,255' : i === 1 ? '120,160,255' : '80,120,255'},0.7)`,
          opacity: 0,
          pointerEvents: 'none',
        }} />
      ))}

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
});

export default CoreLight;
