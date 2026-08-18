'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import dynamic from 'next/dynamic';
import { observatory, runMockFlow } from './state-machine';
import type { ObservatoryContext, InsightData } from './state-machine';
import InsightCard from './InsightCard';

const DataCore = dynamic(() => import('./DataCore'), { ssr: false });

// ── Keywords display ───────────────────────────────────────────────────────

function KeywordNode({ word, index }: { word: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { opacity: 0, scale: 0.6, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.5, delay: index * 0.15, ease: 'back.out(1.7)' },
    );
  }, [index]);

  return (
    <div ref={ref} style={{
      padding: '6px 16px',
      border: '1px solid rgba(73,164,216,0.4)',
      borderRadius: 100,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#7dd4fc',
      background: 'rgba(73,164,216,0.08)',
      backdropFilter: 'blur(8px)',
    }}>
      {word}
    </div>
  );
}

// ── Status message ─────────────────────────────────────────────────────────

function StatusMessage({ message }: { message: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!ref.current || !message) return;
    gsap.fromTo(ref.current,
      { opacity: 0, y: 8, filter: 'blur(4px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'power2.out' },
    );
  }, [message]);

  if (!message) return null;
  return (
    <p ref={ref} style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'rgba(73,164,216,0.7)',
      margin: 0,
    }}>
      {message}
    </p>
  );
}

// ── Scanning dots ──────────────────────────────────────────────────────────

function ScanningDots() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'rgba(73,164,216,0.6)',
          animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ObservatoryPage() {
  const [ctx, setCtx] = useState<ObservatoryContext>(() => observatory.getContext());
  const [visibleInsights, setVisibleInsights] = useState<InsightData[]>([]);
  const [inputValue, setInputValue] = useState('');

  const idleRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLDivElement>(null);
  const analyzingRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const coreWrapRef = useRef<HTMLDivElement>(null);
  const prevState = useRef(ctx.state);

  // Subscribe to state machine
  useEffect(() => {
    return observatory.subscribe(setCtx);
  }, []);

  // Animate state transitions
  useEffect(() => {
    const prev = prevState.current;
    const next = ctx.state;
    prevState.current = next;
    if (prev === next) return;

    const tl = gsap.timeline();

    // Fade out previous overlay
    const overlays = [idleRef, queryRef, analyzingRef];
    overlays.forEach(r => {
      if (r.current) tl.to(r.current, { opacity: 0, y: -12, duration: 0.3, ease: 'power2.in' }, 0);
    });

    if (next === 'IDLE') {
      tl.fromTo(idleRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.35,
      );
      if (coreWrapRef.current) {
        tl.to(coreWrapRef.current, { scale: 1, opacity: 1, duration: 0.8, ease: 'power2.out' }, 0.2);
      }
      setVisibleInsights([]);
    }

    if (next === 'QUERY_RECEIVED') {
      tl.fromTo(queryRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.3,
      );
      if (coreWrapRef.current) {
        tl.to(coreWrapRef.current, { scale: 1.08, duration: 0.6, ease: 'power2.out' }, 0.2);
      }
    }

    if (next === 'ANALYZING' || next === 'FETCHING_DATA' || next === 'GENERATING_VISUALIZATIONS') {
      tl.fromTo(analyzingRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.3,
      );
      if (coreWrapRef.current) {
        tl.to(coreWrapRef.current, { scale: 1.15, duration: 0.8, ease: 'power2.out' }, 0.1);
      }
    }

    if (next === 'REVEAL') {
      // Core expands and fades
      if (coreWrapRef.current) {
        tl.to(coreWrapRef.current, { scale: 1.6, opacity: 0, duration: 0.9, ease: 'power3.in' }, 0);
      }
      // Reveal insights staggered
      if (ctx.insights.length > 0) {
        setVisibleInsights(ctx.insights);
      }
    }

    if (next === 'PRESENTATION') {
      if (coreWrapRef.current) {
        tl.set(coreWrapRef.current, { scale: 0.4, opacity: 0 });
      }
      // Stagger insight cards in
      setTimeout(() => {
        const cards = document.querySelectorAll('.insight-card');
        gsap.fromTo(cards,
          { opacity: 0, y: 32, scale: 0.96 },
          { opacity: 1, y: 0, scale: 1, duration: 0.65, stagger: 0.12, ease: 'power3.out' },
        );
        // Animate presentation header
        if (presentationRef.current) {
          gsap.fromTo(presentationRef.current,
            { opacity: 0, y: -16 },
            { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
          );
        }
      }, 100);
    }
  }, [ctx.state, ctx.insights]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    runMockFlow(inputValue.trim());
    setInputValue('');
  }, [inputValue]);

  const handleReset = useCallback(() => {
    observatory.transition('IDLE');
  }, []);

  const isActive = ctx.state !== 'IDLE' && ctx.state !== 'PRESENTATION';
  const isPresentation = ctx.state === 'PRESENTATION';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#060810',
      color: '#e4eeff',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Inline keyframes */}
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes scanLine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Ambient background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(73,164,216,0.06) 0%, transparent 70%)',
      }} />

      {/* ── PRESENTATION layout ─────────────────────────────────────────── */}
      {isPresentation && (
        <div style={{ position: 'relative', zIndex: 10, padding: '32px 40px', minHeight: '100vh' }}>
          {/* Header */}
          <div ref={presentationRef} style={{ opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(73,164,216,0.7)', margin: '0 0 4px' }}>
                AI Data Observatory
              </p>
              <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#e0f2fe' }}>
                {ctx.query?.raw ?? 'Data Insights'}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {visibleInsights.length} insights
              </span>
              <button
                onClick={handleReset}
                style={{
                  padding: '8px 20px', borderRadius: 100, border: '1px solid rgba(73,164,216,0.3)',
                  background: 'rgba(73,164,216,0.08)', color: '#7dd4fc', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em',
                  fontFamily: 'inherit',
                }}
              >
                New Query
              </button>
            </div>
          </div>

          {/* Insights grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gridTemplateRows: 'auto',
            gap: 20,
          }}>
            {visibleInsights.map((insight, i) => (
              <div
                key={insight.id}
                style={{ gridColumn: insight.isPrimary ? '1 / -1' : undefined }}
              >
                <InsightCard insight={insight} index={i} visible={true} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── OBSERVATORY center stage ────────────────────────────────────── */}
      {!isPresentation && (
        <div style={{
          position: 'relative', zIndex: 10,
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0,
          padding: '40px 24px',
        }}>
          {/* Data Core canvas */}
          <div ref={coreWrapRef} style={{ width: 340, height: 340, position: 'relative', flexShrink: 0 }}>
            <DataCore state={ctx.state} />
            {/* Center glow */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(circle 80px at 50% 50%, rgba(73,164,216,0.12) 0%, transparent 70%)',
            }} />
          </div>

          {/* State overlays — stacked, GSAP controls visibility */}
          <div style={{ position: 'relative', height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, marginTop: -16 }}>

            {/* IDLE */}
            <div ref={idleRef} style={{ position: 'absolute', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <p style={{ fontSize: 22, fontWeight: 600, color: 'rgba(224,242,254,0.9)', margin: 0, letterSpacing: '-0.01em' }}>
                Your data is waiting.
              </p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 400 }}>
                Ask Alexa to explore your data.
              </p>
            </div>

            {/* QUERY_RECEIVED */}
            <div ref={queryRef} style={{ position: 'absolute', opacity: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <StatusMessage message="QUERY RECEIVED" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 400 }}>
                {ctx.query?.keywords.map((w, i) => <KeywordNode key={w} word={w} index={i} />)}
              </div>
            </div>

            {/* ANALYZING / FETCHING / GENERATING */}
            <div ref={analyzingRef} style={{ position: 'absolute', opacity: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <StatusMessage message={ctx.statusMessage} />
              <ScanningDots />
            </div>
          </div>

          {/* Input — only visible in IDLE */}
          <form
            onSubmit={handleSubmit}
            style={{
              marginTop: 40,
              display: 'flex', gap: 10, alignItems: 'center',
              opacity: ctx.state === 'IDLE' ? 1 : 0,
              pointerEvents: ctx.state === 'IDLE' ? 'auto' : 'none',
              transition: 'opacity 0.3s ease',
            }}
          >
            <input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Simulate a query..."
              style={{
                width: 320, padding: '12px 20px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(73,164,216,0.2)',
                borderRadius: 100, color: '#e4eeff',
                fontSize: 14, fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '12px 24px', borderRadius: 100,
                background: 'rgba(73,164,216,0.15)',
                border: '1px solid rgba(73,164,216,0.35)',
                color: '#7dd4fc', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                letterSpacing: '0.04em',
              }}
            >
              Ask
            </button>
          </form>

          {/* Demo shortcuts */}
          {ctx.state === 'IDLE' && (
            <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                'Dame diagramas de ventas de motos',
                'Resumen ejecutivo de ventas',
                'Creditos atrasados por estado',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => runMockFlow(q)}
                  style={{
                    padding: '6px 14px', borderRadius: 100, fontSize: 11,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'transparent', color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(73,164,216,0.3)'; }}
                  onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
