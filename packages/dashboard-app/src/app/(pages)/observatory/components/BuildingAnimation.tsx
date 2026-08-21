'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import type { ObservatoryState } from '../state-machine';

interface Props {
  state: ObservatoryState;
  query: string | null;
  statusMessage: string;
}

export default function BuildingAnimation({ state, query, statusMessage }: Props) {
  const gridLinesHRef = useRef<(HTMLDivElement | null)[]>([]);
  const gridLinesVRef = useRef<(HTMLDivElement | null)[]>([]);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<SVGPathElement>(null);
  
  const [buildPhase, setBuildPhase] = useState(0);
  const prevPhase = useRef(0);

  const barHeights = [40, 65, 35, 80, 50, 88, 45, 70];

  // Map state to build phase
  useEffect(() => {
    let phase = 0;
    if (state === 'QUERY_RECEIVED') phase = 1;
    else if (state === 'ANALYZING') phase = 2;
    else if (state === 'FETCHING_DATA') phase = 3;
    else if (state === 'GENERATING_VISUALIZATIONS') phase = 4;
    else if (state === 'REVEAL') phase = 5;
    
    if (phase >= prevPhase.current) {
      setBuildPhase(phase);
      prevPhase.current = phase;
    }
  }, [state]);

  // Phase 1+: Grid lines animate in
  useEffect(() => {
    if (buildPhase < 1) return;
    
    gridLinesHRef.current.forEach((line, i) => {
      if (!line) return;
      gsap.fromTo(line,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 0.4, duration: 0.5, ease: 'power2.out', delay: i * 0.05, transformOrigin: 'left' }
      );
    });
    
    gridLinesVRef.current.forEach((line, i) => {
      if (!line) return;
      gsap.fromTo(line,
        { scaleY: 0, opacity: 0 },
        { scaleY: 1, opacity: 0.4, duration: 0.5, ease: 'power2.out', delay: 0.2 + i * 0.05, transformOrigin: 'top' }
      );
    });
  }, [buildPhase]);

  // Phase 3: Bars grow
  useEffect(() => {
    if (buildPhase < 3) return;
    
    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      gsap.fromTo(bar,
        { scaleY: 0 },
        { scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)', delay: i * 0.07, transformOrigin: 'bottom' }
      );
    });
  }, [buildPhase]);

  // Phase 4: Line draws
  useEffect(() => {
    if (buildPhase < 4 || !lineRef.current) return;
    
    const length = lineRef.current.getTotalLength();
    gsap.set(lineRef.current, { strokeDasharray: length, strokeDashoffset: length });
    gsap.to(lineRef.current, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' });
  }, [buildPhase]);

  const steps = ['Recibiendo', 'Analizando', 'Obteniendo', 'Generando', 'Listo'];

  return (
    <div style={{
      width: '100%',
      maxWidth: 700,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 32,
      padding: 24,
    }}>
      {/* Query */}
      {query && (
        <h2 style={{
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text)',
          textAlign: 'center',
          margin: 0,
          opacity: buildPhase >= 1 ? 1 : 0,
          transform: buildPhase >= 1 ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.5s ease',
        }}>
          <span style={{ color: 'var(--primary)', opacity: 0.5 }}>"</span>
          {query}
          <span style={{ color: 'var(--primary)', opacity: 0.5 }}>"</span>
        </h2>
      )}

      {/* Chart area */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 260,
        background: 'var(--surface)',
        borderRadius: 16,
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        {/* Inner grid - horizontal */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`h${i}`}
            ref={el => { gridLinesHRef.current[i] = el; }}
            style={{
              position: 'absolute',
              left: 40,
              right: 20,
              top: `${15 + i * 14}%`,
              height: 1,
              background: 'var(--border-color)',
              opacity: 0,
            }}
          />
        ))}
        
        {/* Inner grid - vertical */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`v${i}`}
            ref={el => { gridLinesVRef.current[i] = el; }}
            style={{
              position: 'absolute',
              left: `${10 + i * 11}%`,
              top: 20,
              bottom: 40,
              width: 1,
              background: 'var(--border-color)',
              opacity: 0,
            }}
          />
        ))}

        {/* Bars */}
        <div style={{
          position: 'absolute',
          inset: '30px 30px 40px 50px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '3%',
        }}>
          {barHeights.map((h, i) => (
            <div
              key={i}
              ref={el => { barsRef.current[i] = el; }}
              style={{
                flex: 1,
                height: `${h}%`,
                background: 'linear-gradient(to top, var(--primary), var(--primary-light))',
                borderRadius: '4px 4px 0 0',
                boxShadow: '0 0 20px var(--primary)',
                transform: 'scaleY(0)',
                transformOrigin: 'bottom',
              }}
            />
          ))}
        </div>

        {/* Line chart */}
        <svg
          style={{ position: 'absolute', inset: '30px 30px 40px 50px' }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
          <path
            ref={lineRef}
            d={`M ${barHeights.map((h, i) => `${5 + i * 13} ${100 - h}`).join(' L ')}`}
            fill="none"
            stroke="url(#lg)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Particles */}
        {buildPhase >= 3 && buildPhase < 5 && Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${20 + Math.random() * 60}%`,
              top: `${20 + Math.random() * 50}%`,
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'var(--primary)',
              boxShadow: '0 0 8px var(--primary)',
              animation: `particle 2s ease-out ${i * 0.1}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {steps.map((label, i) => {
          const active = buildPhase === i + 1;
          const done = buildPhase > i + 1;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: active ? 12 : 8,
                  height: active ? 12 : 8,
                  borderRadius: '50%',
                  background: done ? '#34d399' : active ? 'var(--primary)' : 'var(--surface-3)',
                  boxShadow: active ? '0 0 16px var(--primary)' : done ? '0 0 8px #34d399' : 'none',
                  transition: 'all 0.3s',
                  animation: active ? 'pulse 1.2s ease-in-out infinite' : 'none',
                }} />
                <span style={{
                  fontSize: 9,
                  fontWeight: active ? 600 : 400,
                  color: done ? '#34d399' : active ? 'var(--primary)' : 'var(--text-tertiary)',
                  opacity: active || done ? 1 : 0.5,
                }}>{label}</span>
              </div>
              {i < 4 && (
                <div style={{
                  width: 24,
                  height: 2,
                  background: done ? '#34d399' : 'var(--surface-3)',
                  marginBottom: 16,
                  transition: 'all 0.3s',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Status */}
      {statusMessage && (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
          {statusMessage}
        </p>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
        @keyframes particle {
          0% { opacity: 0.8; transform: translate(0, 0) scale(1); }
          100% { opacity: 0; transform: translate(20px, -30px) scale(0); }
        }
      `}</style>
    </div>
  );
}
