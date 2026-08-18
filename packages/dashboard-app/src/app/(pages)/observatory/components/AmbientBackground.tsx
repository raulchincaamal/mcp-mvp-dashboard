'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import type { CursorState } from '../hooks/useCursor';

interface Props {
  cursor: CursorState;
}

export default function AmbientBackground({ cursor }: Props) {
  const aurora1 = useRef<HTMLDivElement>(null);
  const aurora2 = useRef<HTMLDivElement>(null);
  const aurora3 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aurora1.current) {
      gsap.to(aurora1.current, {
        x: cursor.normalizedX * 30,
        y: cursor.normalizedY * 20,
        duration: 1.2,
        ease: 'power2.out',
      });
    }
    if (aurora2.current) {
      gsap.to(aurora2.current, {
        x: cursor.normalizedX * -20,
        y: cursor.normalizedY * -15,
        duration: 1.4,
        ease: 'power2.out',
      });
    }
    if (aurora3.current) {
      gsap.to(aurora3.current, {
        x: cursor.normalizedX * 15,
        y: cursor.normalizedY * 25,
        duration: 1.6,
        ease: 'power2.out',
      });
    }
  }, [cursor.normalizedX, cursor.normalizedY]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      background: 'var(--bg)',
      overflow: 'hidden',
      transition: 'background 0.3s ease',
    }}>
      {/* Aurora 1 - Primary */}
      <div
        ref={aurora1}
        style={{
          position: 'absolute',
          top: '10%',
          left: '30%',
          width: '60vw',
          height: '50vh',
          background: 'radial-gradient(ellipse at center, var(--primary-light) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'float1 20s ease-in-out infinite',
          opacity: 0.8,
        }}
      />

      {/* Aurora 2 - Accent */}
      <div
        ref={aurora2}
        style={{
          position: 'absolute',
          top: '40%',
          right: '20%',
          width: '50vw',
          height: '40vh',
          background: 'radial-gradient(ellipse at center, rgba(120, 80, 180, 0.15) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'float2 25s ease-in-out infinite',
        }}
      />

      {/* Aurora 3 - Secondary */}
      <div
        ref={aurora3}
        style={{
          position: 'absolute',
          bottom: '20%',
          left: '40%',
          width: '40vw',
          height: '35vh',
          background: 'radial-gradient(ellipse at center, var(--primary-light) 0%, transparent 60%)',
          filter: 'blur(70px)',
          animation: 'float3 18s ease-in-out infinite',
          opacity: 0.6,
        }}
      />

      {/* Subtle grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(var(--border-color) 1px, transparent 1px),
          linear-gradient(90deg, var(--border-color) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
        opacity: 0.3,
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 50%, var(--bg) 100%)',
        opacity: 0.5,
      }} />

      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, 25px) scale(1.1); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(25px, -15px); }
          66% { transform: translate(-15px, 20px); }
        }
      `}</style>
    </div>
  );
}
