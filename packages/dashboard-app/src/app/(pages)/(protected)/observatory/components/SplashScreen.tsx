'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridLinesRef = useRef<(HTMLDivElement | null)[]>([]);
  const logoRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const tl = gsap.timeline();
    
    // 1. Grid lines draw in from edges
    gridLinesRef.current.forEach((line, i) => {
      if (!line) return;
      const isHorizontal = i < 12;
      const fromLeft = i % 2 === 0;
      
      tl.fromTo(line,
        { 
          scaleX: isHorizontal ? 0 : 1,
          scaleY: isHorizontal ? 1 : 0,
          opacity: 0,
          transformOrigin: isHorizontal ? (fromLeft ? 'left' : 'right') : (fromLeft ? 'top' : 'bottom'),
        },
        { 
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          duration: 0.4,
          ease: 'power2.out',
        },
        i * 0.02
      );
    });

    // 2. Center glow pulses in
    tl.fromTo(glowRef.current,
      { opacity: 0, scale: 0.5 },
      { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' },
      0.3
    );

    // 3. Logo appears with scale + glow
    tl.fromTo(logoRef.current,
      { opacity: 0, scale: 0.5, rotateY: -90 },
      { opacity: 1, scale: 1, rotateY: 0, duration: 0.8, ease: 'back.out(1.5)' },
      0.5
    );

    // 4. Title slides up
    tl.fromTo(titleRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
      0.8
    );

    // 5. Subtitle fades in
    tl.fromTo(subtitleRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
      1.0
    );

    // 6. Progress bar
    tl.fromTo(progressRef.current,
      { opacity: 0, scaleX: 0 },
      { opacity: 1, scaleX: 1, duration: 0.4, ease: 'power2.out', transformOrigin: 'left' },
      1.2
    );

    // 7. Animate progress
    tl.to({}, {
      duration: 1.5,
      onUpdate: function() {
        setProgress(Math.round(this.progress() * 100));
      },
    }, 1.4);

    // 8. Exit animation
    tl.to(containerRef.current, {
      opacity: 0,
      scale: 1.1,
      duration: 0.5,
      ease: 'power2.in',
      onComplete,
    }, 3.2);

    return () => { tl.kill(); };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background grid */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {/* Horizontal lines */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={`h${i}`}
            ref={el => { gridLinesRef.current[i] = el; }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${(i + 1) * 8}%`,
              height: 1,
              background: `linear-gradient(90deg, transparent, var(--border-color) 20%, var(--border-color) 80%, transparent)`,
              opacity: 0,
            }}
          />
        ))}
        
        {/* Vertical lines */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={`v${i}`}
            ref={el => { gridLinesRef.current[12 + i] = el; }}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(i + 1) * 8}%`,
              width: 1,
              background: `linear-gradient(180deg, transparent, var(--border-color) 20%, var(--border-color) 80%, transparent)`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Center glow */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, var(--primary-light) 0%, transparent 60%)',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Scan lines */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
          boxShadow: '0 0 30px var(--primary)',
          animation: 'scanDown 2s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 2,
          background: 'linear-gradient(180deg, transparent, var(--primary), transparent)',
          boxShadow: '0 0 30px var(--primary)',
          animation: 'scanRight 2.5s ease-in-out infinite',
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        
        {/* Logo */}
        <div
          ref={logoRef}
          style={{
            width: 100,
            height: 100,
            borderRadius: 24,
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 60px var(--primary), 0 20px 40px rgba(0,0,0,0.3)',
            opacity: 0,
            perspective: 1000,
          }}
        >
          <span style={{ fontSize: 48, color: '#fff', textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>◈</span>
        </div>

        {/* Title */}
        <div ref={titleRef} style={{ textAlign: 'center', opacity: 0 }}>
          <h1 style={{
            fontSize: 42,
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Observatory
          </h1>
        </div>

        {/* Subtitle */}
        <div ref={subtitleRef} style={{ opacity: 0 }}>
          <p style={{
            fontSize: 14,
            color: 'var(--text-tertiary)',
            margin: 0,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}>
            AI-Powered Dashboard Generation
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ width: 200, marginTop: 16 }}>
          <div
            ref={progressRef}
            style={{
              height: 3,
              background: 'var(--surface-3)',
              borderRadius: 2,
              overflow: 'hidden',
              opacity: 0,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--primary), #34d399)',
                borderRadius: 2,
                boxShadow: '0 0 10px var(--primary)',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
          <p style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            marginTop: 8,
            letterSpacing: '0.1em',
          }}>
            {progress < 100 ? 'INITIALIZING...' : 'READY'}
          </p>
        </div>
      </div>

      {/* Corner decorations */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
        <div
          key={corner}
          style={{
            position: 'absolute',
            width: 60,
            height: 60,
            ...(corner.includes('top') ? { top: 30 } : { bottom: 30 }),
            ...(corner.includes('left') ? { left: 30 } : { right: 30 }),
            borderTop: corner.includes('top') ? '2px solid var(--primary)' : 'none',
            borderBottom: corner.includes('bottom') ? '2px solid var(--primary)' : 'none',
            borderLeft: corner.includes('left') ? '2px solid var(--primary)' : 'none',
            borderRight: corner.includes('right') ? '2px solid var(--primary)' : 'none',
            opacity: 0.5,
          }}
        />
      ))}

      <style>{`
        @keyframes scanDown {
          0% { top: 0; opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.6; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes scanRight {
          0% { left: 0; opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
