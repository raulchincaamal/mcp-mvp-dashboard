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
import InsightCard from './components/InsightCard';

export default function ObservatoryPage() {
  const cursor = useCursor();
  const [ctx, setCtx] = useState<ObservatoryContext>(() => observatory.getContext());
  const [visibleInsights, setVisibleInsights] = useState<InsightData[]>([]);
  const [inputValue, setInputValue] = useState('');

  const sceneRef = useRef<HTMLDivElement>(null);
  const idleRef = useRef<HTMLDivElement>(null);
  const buildingRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const prevState = useRef(ctx.state);

  useEffect(() => observatory.subscribe(setCtx), []);

  // Scene parallax
  useEffect(() => {
    if (!sceneRef.current) return;
    gsap.to(sceneRef.current, {
      x: cursor.normalizedX * -15,
      y: cursor.normalizedY * -10,
      duration: 0.8,
      ease: 'power2.out',
    });
  }, [cursor.normalizedX, cursor.normalizedY]);

  // State transitions
  useEffect(() => {
    const prev = prevState.current;
    const next = ctx.state;
    prevState.current = next;
    if (prev === next) return;

    const tl = gsap.timeline();

    if (next === 'IDLE') {
      setVisibleInsights([]);
      tl.to(buildingRef.current, { opacity: 0, y: -20, duration: 0.3 }, 0);
      tl.to(presentationRef.current, { opacity: 0, duration: 0.3 }, 0);
      tl.fromTo(idleRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.3);
    }

    if (['QUERY_RECEIVED', 'ANALYZING', 'FETCHING_DATA', 'GENERATING_VISUALIZATIONS'].includes(next)) {
      tl.to(idleRef.current, { opacity: 0, y: -20, duration: 0.3 }, 0);
      tl.fromTo(buildingRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.2);
    }

    if (next === 'REVEAL') {
      if (ctx.insights.length > 0) setVisibleInsights(ctx.insights);
      tl.to(buildingRef.current, { opacity: 0, scale: 1.1, duration: 0.4 }, 0);
    }

    if (next === 'PRESENTATION') {
      tl.to(idleRef.current, { opacity: 0, duration: 0.2 }, 0);
      tl.to(buildingRef.current, { opacity: 0, duration: 0.2 }, 0);
      tl.fromTo(presentationRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.3);
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
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      cursor: 'default',
      transition: 'background 0.3s ease, color 0.3s ease',
    }}>
      <AmbientBackground cursor={cursor} />
      <CursorLight cursor={cursor} />

      <div ref={sceneRef} style={{ position: 'relative', zIndex: 5, minHeight: '100vh', willChange: 'transform' }}>
        <AmbientPanels cursor={cursor} visible={isIdle} />

        {/* IDLE */}
        <div
          ref={idleRef}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: 40,
            pointerEvents: isIdle ? 'auto' : 'none',
          }}
        >
          <CoreLight cursor={cursor} state={ctx.state} />

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <h1 style={{
              fontSize: 28,
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
              margin: '8px 0 0',
            }}>
              Ask Alexa to explore your data.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <GlassPanel cursor={cursor} depth={0.2} glowOnHover={false}>
              <input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Simulate a query..."
                style={{
                  width: 300,
                  padding: '14px 20px',
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
                  padding: '14px 24px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '0.04em',
                }}
              >
                Ask
              </button>
            </GlassPanel>
          </form>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            {[
              'Dame diagramas de ventas de motos',
              'Resumen ejecutivo de ventas',
              'Creditos atrasados por estado',
            ].map(q => (
              <button
                key={q}
                onClick={() => runMockFlow(q)}
                style={{
                  padding: '8px 16px',
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

        {/* BUILDING */}
        <div
          ref={buildingRef}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: 40,
            opacity: 0,
            pointerEvents: isBuilding ? 'auto' : 'none',
          }}
        >
          <CoreLight cursor={cursor} state={ctx.state} />

          <div style={{ textAlign: 'center' }}>
            {ctx.query && (
              <h2 style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--text)',
                margin: '0 0 8px',
                letterSpacing: '-0.01em',
              }}>
                {ctx.query.raw}
              </h2>
            )}
            <p style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--primary)',
              margin: 0,
            }}>
              {ctx.statusMessage}
            </p>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16 }}>
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>

          <style>{`
            @keyframes pulse {
              0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
              40% { opacity: 1; transform: scale(1.2); }
            }
          `}</style>
        </div>

        {/* PRESENTATION */}
        <div
          ref={presentationRef}
          style={{
            position: 'relative',
            minHeight: '100vh',
            padding: '32px 48px',
            opacity: 0,
            pointerEvents: isPresentation ? 'auto' : 'none',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 32,
          }}>
            <div>
              <p style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--primary)',
                margin: '0 0 4px',
              }}>
                Executive Intelligence
              </p>
              <h1 style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}>
                {ctx.query?.raw ?? 'Data Insights'}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                {visibleInsights.length} insights
              </span>
              <GlassPanel cursor={cursor} depth={0.3}>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    letterSpacing: '0.04em',
                  }}
                >
                  New Query
                </button>
              </GlassPanel>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 24,
          }}>
            {visibleInsights.map((insight, i) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                cursor={cursor}
                index={i}
                visible={isPresentation}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
