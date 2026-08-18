'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { useCursor } from './hooks/useCursor';
import { observatory, runMockFlow } from './state-machine';
import type { ObservatoryContext, InsightData } from './state-machine';
import AmbientBackground from './components/AmbientBackground';
import CursorLight from './components/CursorLight';
import AmbientPanels from './components/AmbientPanels';
import GlassPanel from './components/GlassPanel';
import CoreLight from './components/CoreLight';
import BuildingAnimation from './components/BuildingAnimation';
import ScrollPresentation from './components/ScrollPresentation';

export default function ObservatoryPage() {
  const cursor = useCursor();
  const [ctx, setCtx] = useState<ObservatoryContext>(() => observatory.getContext());
  const [visibleInsights, setVisibleInsights] = useState<InsightData[]>([]);
  const [inputValue, setInputValue] = useState('');

  const sceneRef = useRef<HTMLDivElement>(null);
  const idleRef = useRef<HTMLDivElement>(null);
  const buildingRef = useRef<HTMLDivElement>(null);
  const coreContainerRef = useRef<HTMLDivElement>(null);
  const prevState = useRef(ctx.state);

  useEffect(() => observatory.subscribe(setCtx), []);

  // Scene parallax (only when not in presentation)
  useEffect(() => {
    if (!sceneRef.current || ctx.state === 'PRESENTATION') return;
    gsap.to(sceneRef.current, {
      x: cursor.normalizedX * -12,
      y: cursor.normalizedY * -8,
      duration: 0.8,
      ease: 'power2.out',
    });
  }, [cursor.normalizedX, cursor.normalizedY, ctx.state]);

  // State transitions
  useEffect(() => {
    const prev = prevState.current;
    const next = ctx.state;
    prevState.current = next;
    if (prev === next) return;

    const tl = gsap.timeline();

    if (next === 'IDLE') {
      setVisibleInsights([]);
      tl.to(buildingRef.current, { opacity: 0, y: -15, duration: 0.4, ease: 'power2.in' }, 0);
      tl.fromTo(idleRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.3);
    }

    if (next === 'QUERY_RECEIVED') {
      // First transition from IDLE to building
      tl.to(idleRef.current, { opacity: 0, y: -15, duration: 0.4, ease: 'power2.in' }, 0);
      tl.fromTo(buildingRef.current, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.3);
    }

    // For subsequent building states, don't re-animate the container
    // The BuildingAnimation component handles internal transitions

    if (next === 'REVEAL') {
      if (ctx.insights.length > 0) setVisibleInsights(ctx.insights);
      // Keep building visible during reveal, it will animate internally
    }

    if (next === 'PRESENTATION') {
      // Smooth fade out of building state
      tl.to(buildingRef.current, { 
        opacity: 0, 
        scale: 1.03, 
        y: -20, 
        duration: 0.6, 
        ease: 'power2.in' 
      }, 0);
    }
  }, [ctx.state, ctx.insights]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    runMockFlow(inputValue.trim());
    setInputValue('');
  }, [inputValue]);

  const handleReset = useCallback(() => observatory.transition('IDLE'), []);

  const isIdle = ctx.state === 'IDLE';
  const isBuilding = ['QUERY_RECEIVED', 'ANALYZING', 'FETCHING_DATA', 'GENERATING_VISUALIZATIONS', 'REVEAL'].includes(ctx.state);
  const isPresentation = ctx.state === 'PRESENTATION';

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      cursor: 'default',
    }}>
      {/* Background with orbiting charts - pass center reference */}
      <AmbientBackground 
        cursor={cursor} 
        centerElement={isIdle ? coreContainerRef.current : null} 
      />
      
      <CursorLight cursor={cursor} />

      {/* IDLE & BUILDING states */}
      {!isPresentation && (
        <div 
          ref={sceneRef} 
          style={{ 
            position: 'absolute', 
            inset: 0, 
            zIndex: 5, 
            willChange: 'transform',
          }}
        >
          <AmbientPanels cursor={cursor} visible={isIdle} />

          {/* IDLE STATE */}
          <div
            ref={idleRef}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              padding: 40,
              pointerEvents: isIdle ? 'auto' : 'none',
            }}
          >
            {/* CoreLight - center of orbits */}
            <div ref={coreContainerRef}>
              <CoreLight cursor={cursor} state={ctx.state} />
            </div>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <h1 style={{
                fontSize: 26,
                fontWeight: 600,
                color: 'var(--text)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}>
                Executive Intelligence
              </h1>
              <p style={{
                fontSize: 14,
                color: 'var(--text-tertiary)',
                margin: '6px 0 0',
              }}>
                Ask Alexa to explore your data.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <GlassPanel cursor={cursor} depth={0.2} glowOnHover={false}>
                <input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="Simulate a query..."
                  style={{
                    width: 280,
                    padding: '12px 18px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </GlassPanel>
              <GlassPanel cursor={cursor} depth={0.2}>
                <button
                  type="submit"
                  style={{
                    padding: '12px 22px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Ask
                </button>
              </GlassPanel>
            </form>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
              {[
                'Dame diagramas de ventas de motos',
                'Resumen ejecutivo de ventas',
                'Creditos atrasados por estado',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => runMockFlow(q)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 100,
                    fontSize: 11,
                    border: '1px solid var(--border-color)',
                    background: 'var(--surface)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    const btn = e.target as HTMLButtonElement;
                    btn.style.borderColor = 'var(--primary)';
                    btn.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={e => {
                    const btn = e.target as HTMLButtonElement;
                    btn.style.borderColor = 'var(--border-color)';
                    btn.style.color = 'var(--text-secondary)';
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* BUILDING STATE - No CoreLight here, just the animation */}
          <div
            ref={buildingRef}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              opacity: 0,
              pointerEvents: isBuilding ? 'auto' : 'none',
            }}
          >
            <BuildingAnimation
              state={ctx.state}
              query={ctx.query?.raw ?? null}
              statusMessage={ctx.statusMessage}
            />
          </div>
        </div>
      )}

      {/* PRESENTATION STATE */}
      {isPresentation && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <ScrollPresentation
            insights={visibleInsights}
            cursor={cursor}
            query={ctx.query?.raw ?? null}
            onReset={handleReset}
          />
        </div>
      )}
    </div>
  );
}
