'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { useCursor } from './hooks/useCursor';
import { observatory, runMockFlow } from './state-machine';
import type { ObservatoryContext, InsightData } from './state-machine';
import AmbientBackground from './components/AmbientBackground';
import CursorLight from './components/CursorLight';
import GlassPanel from './components/GlassPanel';
import CoreLight from './components/CoreLight';
import BuildingAnimation from './components/BuildingAnimation';
import ScrollPresentation from './components/ScrollPresentation';

function FadeIn({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power2.out' });
  }, []);
  return <div ref={ref} style={{ opacity: 0 }}>{children}</div>;
}

export default function ObservatoryPage() {
  const cursor = useCursor();
  const [ctx, setCtx] = useState<ObservatoryContext>(() => observatory.getContext());
  const [visibleInsights, setVisibleInsights] = useState<InsightData[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputOpen, setInputOpen] = useState(false);

  // iOS zoom state
  const [zoomLabel, setZoomLabel] = useState<string | null>(null);
  const zoomOverlayRef = useRef<HTMLDivElement>(null);
  const buildingRef    = useRef<HTMLDivElement>(null);
  const inputPanelRef  = useRef<HTMLDivElement>(null);
  const prevState      = useRef(ctx.state);

  useEffect(() => observatory.subscribe(setCtx), []);

  // Animate input panel
  useEffect(() => {
    if (!inputPanelRef.current) return;
    if (inputOpen) {
      gsap.fromTo(inputPanelRef.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }
      );
    } else {
      gsap.to(inputPanelRef.current, { opacity: 0, y: 10, duration: 0.25, ease: 'power2.in' });
    }
  }, [inputOpen]);

  // State transitions
  useEffect(() => {
    const prev = prevState.current;
    const next = ctx.state;
    prevState.current = next;
    if (prev === next) return;

    if (next === 'IDLE') {
      setVisibleInsights([]);
      setInputOpen(false);
      setZoomLabel(null);
      gsap.to(buildingRef.current, { opacity: 0, y: -15, duration: 0.4, ease: 'power2.in' });
    }

    if (next === 'QUERY_RECEIVED') {
      setInputOpen(false);
      // BuildingAnimation already visible via zoom overlay
    }

    if (next === 'REVEAL') {
      if (ctx.insights.length > 0) setVisibleInsights(ctx.insights);
    }

    if (next === 'PRESENTATION') {
      // Fade out zoom overlay, then mount ScrollPresentation with its own fade-in
      gsap.to(zoomOverlayRef.current, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.in',
        onComplete: () => setZoomLabel(null),
      });
    }
  }, [ctx.state, ctx.insights]);

  // iOS zoom: card expands to fill screen, then building appears
  const handleCategoryClick = useCallback((label: string, rect: DOMRect) => {
    setZoomLabel(label);

    requestAnimationFrame(() => {
      const el = zoomOverlayRef.current;
      if (!el) return;

      // Start from card position/size
      gsap.set(el, {
        left:         rect.left,
        top:          rect.top,
        width:        rect.width,
        height:       rect.height,
        borderRadius: 18,
        opacity:      1,
      });

      const tl = gsap.timeline();

      // Expand to full screen
      tl.to(el, {
        left:         0,
        top:          0,
        width:        '100vw',
        height:       '100vh',
        borderRadius: 0,
        duration:     0.55,
        ease:         'power3.inOut',
      });

      // Fade in building animation
      tl.fromTo(buildingRef.current,
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' },
        '-=0.1'
      );

      // Dispatch query after zoom starts
      tl.call(() => runMockFlow(`Resumen de ${label}`), [], 0.2);
    });
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    runMockFlow(inputValue.trim());
    setInputValue('');
  }, [inputValue]);

  const handleReset = useCallback(() => observatory.transition('IDLE'), []);

  const isIdle         = ctx.state === 'IDLE';
  const isBuilding     = ['QUERY_RECEIVED', 'ANALYZING', 'FETCHING_DATA', 'GENERATING_VISUALIZATIONS', 'REVEAL'].includes(ctx.state);
  const isPresentation = ctx.state === 'PRESENTATION';

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'var(--bg)', color: 'var(--text)',
      fontFamily: '"Space Grotesk", system-ui, sans-serif',
      position: 'relative', overflow: 'hidden', cursor: 'default',
    }}>

      {/* Layer 0 — Three.js + widgets */}
      <AmbientBackground cursor={cursor} onCategoryClick={handleCategoryClick} />

      {/* Layer 1 — Cursor */}
      <CursorLight cursor={cursor} />

      {/* Layer 2 — CoreLight centrado */}
      {!isPresentation && !zoomLabel && (
        <div
          onClick={() => isIdle && setInputOpen(o => !o)}
          style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 6,
            cursor: isIdle ? 'pointer' : 'default',
          }}
        >
          <CoreLight cursor={cursor} state={ctx.state} />
        </div>
      )}

      {/* Layer 3 — Input panel (aparece al click en CoreLight) */}
      {isIdle && !zoomLabel && (
        <div
          ref={inputPanelRef}
          style={{
            position: 'absolute',
            left: '50%',
            top: 'calc(50% + 110px)',
            transform: 'translateX(-50%)',
            zIndex: 8,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 14,
            opacity: 0,
            pointerEvents: inputOpen ? 'auto' : 'none',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
              Executive Intelligence
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '5px 0 0' }}>
              Ask Alexa to explore your data.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
            <GlassPanel cursor={cursor} depth={0.2} glowOnHover={false}>
              <input
                autoFocus={inputOpen}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Simulate a query..."
                style={{
                  width: 280, padding: '12px 18px',
                  background: 'transparent', border: 'none',
                  color: 'var(--text)',
                  fontSize: 14, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </GlassPanel>
            <GlassPanel cursor={cursor} depth={0.2}>
              <button type="submit" style={{
                padding: '12px 22px', background: 'transparent', border: 'none',
                color: 'var(--primary)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Ask
              </button>
            </GlassPanel>
          </form>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Dame diagramas de ventas de motos', 'Resumen ejecutivo de ventas', 'Creditos atrasados por estado'].map(q => (
              <button key={q} onClick={() => runMockFlow(q)} style={{
                padding: '7px 14px', borderRadius: 100, fontSize: 11,
                border: '1px solid var(--border-color)',
                background: 'var(--surface)',
                color: 'var(--text-tertiary)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
              >{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* Layer 4 — iOS zoom overlay + building animation */}
      {zoomLabel && (
        <div
          ref={zoomOverlayRef}
          style={{
            position: 'fixed',
            background: 'var(--bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-color)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            opacity: 0,
          }}
        >
          <div ref={buildingRef} style={{ opacity: 0, width: '100%', display: 'flex', justifyContent: 'center' }}>
            <BuildingAnimation
              state={ctx.state}
              query={`Resumen de ${zoomLabel}`}
              statusMessage={ctx.statusMessage}
            />
          </div>
        </div>
      )}

      {/* Layer 5 — Presentation */}
      {isPresentation && (
        <FadeIn>
          <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
            <ScrollPresentation
              insights={visibleInsights}
              cursor={cursor}
              query={ctx.query?.raw ?? null}
              onReset={handleReset}
            />
          </div>
        </FadeIn>
      )}
    </div>
  );
}
