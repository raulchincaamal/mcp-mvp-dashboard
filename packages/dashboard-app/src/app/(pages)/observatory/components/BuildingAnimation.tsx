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
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [buildPhase, setBuildPhase] = useState(0);
  const prevPhase = useRef(0);

  // Map state to build phase
  useEffect(() => {
    let phase = 0;
    if (state === 'QUERY_RECEIVED') phase = 1;
    else if (state === 'ANALYZING') phase = 2;
    else if (state === 'FETCHING_DATA') phase = 3;
    else if (state === 'GENERATING_VISUALIZATIONS') phase = 4;
    else if (state === 'REVEAL') phase = 5;
    
    // Only animate forward, not backward
    if (phase >= prevPhase.current) {
      setBuildPhase(phase);
      prevPhase.current = phase;
    }
  }, [state]);

  // Animate chart container on phase change
  useEffect(() => {
    if (!chartRef.current) return;
    
    if (buildPhase >= 4) {
      // Chart building phase - subtle border highlight
      gsap.to(chartRef.current, {
        borderColor: 'var(--primary)',
        duration: 0.4,
        ease: 'power2.out',
      });
    }
    
    if (buildPhase === 5) {
      // Reveal phase - subtle scale
      gsap.to(chartRef.current, {
        scale: 1.01,
        duration: 0.6,
        ease: 'power2.out',
      });
    }
  }, [buildPhase]);

  return (
    <div 
      ref={containerRef} 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
        width: '100%',
        maxWidth: 550,
      }}
    >
      {/* Query text */}
      {query && (
        <h2 style={{
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text)',
          margin: 0,
          textAlign: 'center',
          letterSpacing: '-0.01em',
          opacity: buildPhase >= 1 ? 1 : 0,
          transform: buildPhase >= 1 ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.5s ease',
        }}>
          {query}
        </h2>
      )}

      {/* Building visualization */}
      <div 
        ref={chartRef}
        style={{
          position: 'relative',
          width: 280,
          height: 180,
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
          background: 'var(--surface)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
          transition: 'all 0.4s ease',
        }}
      >
        {/* Grid lines */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          {/* Horizontal grid */}
          {[0.25, 0.5, 0.75].map((y, i) => (
            <line
              key={`h${i}`}
              x1="12%" y1={`${y * 100}%`} x2="88%" y2={`${y * 100}%`}
              stroke="var(--border-color)" strokeWidth="1"
              style={{
                opacity: buildPhase >= 2 ? 0.5 : 0,
                transition: `opacity 0.4s ease ${i * 0.1}s`,
              }}
            />
          ))}
          {/* Vertical grid */}
          {[0.25, 0.5, 0.75].map((x, i) => (
            <line
              key={`v${i}`}
              x1={`${x * 100}%`} y1="12%" x2={`${x * 100}%`} y2="88%"
              stroke="var(--border-color)" strokeWidth="1"
              style={{
                opacity: buildPhase >= 2 ? 0.5 : 0,
                transition: `opacity 0.4s ease ${i * 0.1 + 0.15}s`,
              }}
            />
          ))}
          {/* X Axis */}
          <line
            x1="12%" y1="88%" x2="88%" y2="88%"
            stroke="var(--primary)" strokeWidth="2"
            strokeDasharray="250"
            style={{
              strokeDashoffset: buildPhase >= 2 ? 0 : 250,
              transition: 'stroke-dashoffset 0.6s ease',
            }}
          />
          {/* Y Axis */}
          <line
            x1="12%" y1="12%" x2="12%" y2="88%"
            stroke="var(--primary)" strokeWidth="2"
            strokeDasharray="150"
            style={{
              strokeDashoffset: buildPhase >= 2 ? 0 : 150,
              transition: 'stroke-dashoffset 0.6s ease 0.2s',
            }}
          />
        </svg>

        {/* Data points flying in */}
        {buildPhase >= 3 && (
          <div style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: 12 }).map((_, i) => (
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
                  opacity: 0,
                  animation: `dataFly 1.2s ease-out ${i * 0.08}s forwards`,
                }}
              />
            ))}
          </div>
        )}

        {/* Bars building */}
        {buildPhase >= 4 && (
          <div style={{
            position: 'absolute',
            bottom: '12%',
            left: '18%',
            right: '18%',
            height: '70%',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10%',
          }}>
            {[0.55, 0.8, 0.4, 0.65, 0.9].map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: 'linear-gradient(to top, var(--primary), var(--primary-light))',
                  borderRadius: '3px 3px 0 0',
                  height: `${h * 100}%`,
                  transform: 'scaleY(0)',
                  transformOrigin: 'bottom',
                  animation: `barGrow 0.5s ease-out ${0.3 + i * 0.08}s forwards`,
                }}
              />
            ))}
          </div>
        )}

        {/* Scanning line */}
        {buildPhase >= 3 && buildPhase < 5 && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 2,
            height: '100%',
            background: 'linear-gradient(to bottom, transparent, var(--primary), transparent)',
            animation: 'scanLine 1.8s ease-in-out infinite',
          }} />
        )}

        {/* Success overlay */}
        {buildPhase === 5 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, var(--primary-light) 0%, transparent 60%)',
            opacity: 0,
            animation: 'successFade 0.8s ease-out forwards',
            borderRadius: 'inherit',
          }} />
        )}
      </div>

      {/* Status */}
      <div style={{ textAlign: 'center' }}>
        <p style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--primary)',
          margin: 0,
          minHeight: 16,
          opacity: statusMessage ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}>
          {statusMessage}
        </p>

        {/* Progress indicator */}
        <div style={{ 
          display: 'flex', 
          gap: 10, 
          justifyContent: 'center', 
          marginTop: 14,
        }}>
          {[1, 2, 3, 4, 5].map(phase => (
            <div
              key={phase}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: buildPhase >= phase ? 'var(--primary)' : 'var(--border-color)',
                boxShadow: buildPhase >= phase ? '0 0 12px var(--primary)' : 'none',
                transition: 'all 0.3s ease',
                transform: buildPhase === phase ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes dataFly {
          0% { opacity: 0; transform: translate(-30px, -30px) scale(0); }
          60% { opacity: 0.8; transform: translate(0, 0) scale(1.3); }
          100% { opacity: 0.5; transform: translate(0, 0) scale(1); }
        }
        @keyframes barGrow {
          0% { transform: scaleY(0); }
          70% { transform: scaleY(1.08); }
          100% { transform: scaleY(1); }
        }
        @keyframes scanLine {
          0% { left: 0; opacity: 0; }
          15% { opacity: 0.8; }
          85% { opacity: 0.8; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes glowPulse {
          0% { opacity: 0; }
          50% { opacity: 0.4; }
          100% { opacity: 0.2; }
        }
        @keyframes successFade {
          0% { opacity: 0; }
          50% { opacity: 0.3; }
          100% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
