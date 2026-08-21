'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import type { ObservatoryState } from '../state-machine';

interface Props {
  state: ObservatoryState;
  query: string | null;
  statusMessage: string;
}

// ── Node network canvas — fullscreen, sides only ──────────
function NodeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const primary = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary').trim() || '#49a4d8';

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const SIDE = 0.28; // fraction of screen width for each side

    // Left nodes
    const NL = 20;
    const nodesL = Array.from({ length: NL }, () => ({
      x: Math.random() * W() * SIDE,
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: 1.5 + Math.random() * 2,
    }));

    // Right nodes
    const NR = 20;
    const nodesR = Array.from({ length: NR }, () => ({
      x: W() * (1 - SIDE) + Math.random() * W() * SIDE,
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: 1.5 + Math.random() * 2,
    }));

    const drawGroup = (
      ctx: CanvasRenderingContext2D,
      nodes: typeof nodesL,
      fadeDir: 'left' | 'right',
    ) => {
      const threshold = 120;

      // Edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx   = nodes[i].x - nodes[j].x;
          const dy   = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < threshold) {
            const edgeFade = fadeDir === 'left'
              ? Math.min(nodes[i].x, nodes[j].x) / (W() * SIDE)
              : 1 - Math.max(nodes[i].x, nodes[j].x) / W();
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = primary;
            ctx.globalAlpha = (1 - dist / threshold) * 0.25 * (1 - edgeFade);
            ctx.lineWidth   = 0.8;
            ctx.stroke();
          }
        }
      }

      // Nodes
      nodes.forEach(n => {
        const fade = fadeDir === 'left'
          ? 1 - n.x / (W() * SIDE)
          : (n.x - W() * (1 - SIDE)) / (W() * SIDE);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = primary;
        ctx.globalAlpha = 0.6 * Math.max(0, 1 - fade);
        ctx.fill();
      });
    };

    const tick = () => {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, W(), H());

      drawGroup(ctx, nodesL, 'left');
      drawGroup(ctx, nodesR, 'right');

      ctx.globalAlpha = 1;

      // Move + bounce
      [...nodesL, ...nodesR].forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W()) n.vx *= -1;
        if (n.y < 0 || n.y > H()) n.vy *= -1;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
}

// ── Phase 1: Magnifier ────────────────────────────────────
function PhaseSearch({ active }: { active: boolean }) {
  const ref     = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (active) {
      gsap.fromTo(ref.current,
        { opacity: 0, scale: 0.7 },
        { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }
      );
      gsap.to(glassRef.current, {
        x: 16, y: -10, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1,
      });
    } else {
      gsap.killTweensOf(glassRef.current);
      gsap.to(ref.current, { opacity: 0, scale: 0.85, duration: 0.25 });
    }
  }, [active]);

  return (
    <div ref={ref} style={{ opacity: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div ref={glassRef} style={{ position: 'relative', width: 100, height: 100 }}>
        {/* Circle */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 70, height: 70, borderRadius: '50%',
          border: '3px solid var(--primary)',
          boxShadow: '0 0 30px var(--primary), inset 0 0 20px rgba(73,164,216,0.08)',
        }} />
        {/* Inner glow */}
        <div style={{
          position: 'absolute', top: 8, left: 8, width: 54, height: 54,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(73,164,216,0.12) 0%, transparent 70%)',
        }} />
        {/* Scan line */}
        <div style={{
          position: 'absolute', top: 18, left: 10, right: 18, height: 2,
          background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
          boxShadow: '0 0 8px var(--primary)',
          animation: 'scanMag 1.4s ease-in-out infinite',
          borderRadius: 1,
        }} />
        {/* Handle */}
        <div style={{
          position: 'absolute', bottom: 4, right: 4,
          width: 3, height: 34, borderRadius: 2,
          background: 'linear-gradient(to bottom, var(--primary), var(--primary-dark))',
          transform: 'rotate(45deg)', transformOrigin: 'top center',
          boxShadow: '0 0 10px var(--primary)',
        }} />
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0, letterSpacing: '0.04em' }}>
        Buscando información...
      </p>
    </div>
  );
}

// ── Phase 2: Empty chart ──────────────────────────────────
function PhaseAnalyze({ active }: { active: boolean }) {
  const ref    = useRef<HTMLDivElement>(null);
  const yAxis  = useRef<HTMLDivElement>(null);
  const xAxis  = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    if (active) {
      gsap.fromTo(ref.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
      gsap.fromTo(yAxis.current, { scaleY: 0 }, { scaleY: 1, duration: 0.7, ease: 'power2.out', transformOrigin: 'bottom', delay: 0.15 });
      gsap.fromTo(xAxis.current, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power2.out', transformOrigin: 'left', delay: 0.35 });
      dotsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(el,
          { opacity: 0, scale: 0 },
          { opacity: 1, scale: 1, duration: 0.35, delay: 0.6 + i * 0.12, ease: 'back.out(2)', yoyo: true, repeat: -1, repeatDelay: 1 }
        );
      });
    } else {
      gsap.killTweensOf(dotsRef.current);
      gsap.to(ref.current, { opacity: 0, duration: 0.25 });
    }
  }, [active]);

  const dots = [
    { left: '22%', bottom: '28%' }, { left: '38%', bottom: '52%' },
    { left: '54%', bottom: '38%' }, { left: '68%', bottom: '62%' },
    { left: '80%', bottom: '44%' },
  ];

  return (
    <div ref={ref} style={{ opacity: 0, width: 320, height: 200, position: 'relative' }}>
      {/* Y axis */}
      <div ref={yAxis} style={{
        position: 'absolute', left: 36, top: 12, bottom: 36,
        width: 2, background: 'linear-gradient(to top, var(--primary), var(--primary-light))',
        borderRadius: 1, boxShadow: '0 0 10px var(--primary)',
      }} />
      {/* X axis */}
      <div ref={xAxis} style={{
        position: 'absolute', left: 36, right: 12, bottom: 36,
        height: 2, background: 'linear-gradient(to right, var(--primary), var(--primary-light))',
        borderRadius: 1, boxShadow: '0 0 10px var(--primary)',
      }} />
      {/* Grid lines */}
      {[0.33, 0.6, 0.85].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', left: 38, right: 12,
          bottom: `${36 + y * 130}px`,
          height: 1, background: 'var(--border-color)', opacity: 0.35,
        }} />
      ))}
      {/* Pulsing dots */}
      {dots.map((pos, i) => (
        <div key={i} ref={el => { dotsRef.current[i] = el; }} style={{
          position: 'absolute', ...pos,
          width: 9, height: 9, borderRadius: '50%',
          background: 'var(--primary)',
          boxShadow: '0 0 14px var(--primary)',
          transform: 'translate(-50%, 50%)',
          opacity: 0,
        }} />
      ))}
      <p style={{
        position: 'absolute', bottom: -30, left: 0, right: 0,
        textAlign: 'center', fontSize: 14, color: 'var(--text-tertiary)', margin: 0,
      }}>
        Analizando datos...
      </p>
    </div>
  );
}

// ── Phase 3: Chart building ───────────────────────────────
function PhaseBuild({ active }: { active: boolean }) {
  const ref       = useRef<HTMLDivElement>(null);
  const barsRef   = useRef<(HTMLDivElement | null)[]>([]);
  const glowsRef  = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef   = useRef<SVGPathElement>(null);
  const areaRef   = useRef<SVGPathElement>(null);
  const dotsRef   = useRef<(SVGCircleElement | null)[]>([]);
  const [barsDone, setBarsDone] = useState(false);

  const heights = [42, 74, 36, 88, 54, 92, 46, 72];
  const colors  = ['#7c6fff','#06b6d4','#34d399','#f472b6','#fb923c','#a78bfa','#38bdf8','#4ade80'];

  useEffect(() => {
    if (!ref.current) return;
    if (active) {
      setBarsDone(false);
      gsap.fromTo(ref.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });

      // Bars: stagger grow with overshoot + glow pulse
      const tl = gsap.timeline({
        onComplete: () => setBarsDone(true),
      });
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        tl.fromTo(el,
          { scaleY: 0 },
          { scaleY: 1, duration: 0.55, ease: 'elastic.out(1.2, 0.5)', transformOrigin: 'bottom' },
          0.1 + i * 0.07
        );
      });
      // Glow flashes per bar
      glowsRef.current.forEach((el, i) => {
        if (!el) return;
        tl.fromTo(el,
          { opacity: 0.8, scaleY: 1.3 },
          { opacity: 0, scaleY: 1, duration: 0.4, ease: 'power2.out', transformOrigin: 'bottom' },
          0.1 + i * 0.07 + 0.3
        );
      });

      // Line draws after bars
      if (lineRef.current && areaRef.current) {
        const len = lineRef.current.getTotalLength();
        gsap.set(lineRef.current, { strokeDasharray: len, strokeDashoffset: len, opacity: 0 });
        gsap.set(areaRef.current, { opacity: 0 });
        gsap.to(lineRef.current, { strokeDashoffset: 0, opacity: 1, duration: 1.4, delay: 0.9, ease: 'power2.inOut' });
        gsap.to(areaRef.current, { opacity: 1, duration: 0.8, delay: 1.6, ease: 'power2.out' });
      }

      // Dots pop in
      dotsRef.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(el,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(3)', delay: 1.8 + i * 0.08 }
        );
      });
    } else {
      setBarsDone(false);
      gsap.to(ref.current, { opacity: 0, duration: 0.25 });
    }
  }, [active]);

  const pts  = heights.map((h, i) => [7 + i * 12.5, 94 - h * 0.86]);
  const d    = `M ${pts.map(p => p.join(' ')).join(' L ')}`;
  const area = `${d} L ${pts[pts.length-1][0]} 94 L ${pts[0][0]} 94 Z`;

  return (
    <div ref={ref} style={{ opacity: 0, width: 340, height: 220, position: 'relative' }}>
      {/* Y axis */}
      <div style={{
        position: 'absolute', left: 32, top: 10, bottom: 32,
        width: 2, background: 'linear-gradient(to top, var(--primary), var(--primary-light))',
        borderRadius: 1, boxShadow: '0 0 10px var(--primary)',
      }} />
      {/* X axis */}
      <div style={{
        position: 'absolute', left: 32, right: 10, bottom: 32,
        height: 2, background: 'linear-gradient(to right, var(--primary), var(--primary-light))',
        borderRadius: 1, boxShadow: '0 0 10px var(--primary)',
      }} />
      {/* Grid lines */}
      {[0.3, 0.55, 0.8].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', left: 34, right: 10,
          bottom: `${32 + y * 160}px`,
          height: 1, background: 'var(--border-color)', opacity: 0.4,
        }} />
      ))}

      {/* Bars + glow overlays */}
      <div style={{
        position: 'absolute', left: 38, right: 12, bottom: 34, top: 12,
        display: 'flex', alignItems: 'flex-end', gap: '3%',
      }}>
        {heights.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, position: 'relative' }}>
            {/* Bar */}
            <div ref={el => { barsRef.current[i] = el; }} style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(to top, ${colors[i]}, ${colors[i]}44)`,
              borderRadius: '4px 4px 0 0',
              boxShadow: `0 0 14px ${colors[i]}55`,
              transform: 'scaleY(0)', transformOrigin: 'bottom',
            }} />
            {/* Flash glow on entry */}
            <div ref={el => { glowsRef.current[i] = el; }} style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(to top, ${colors[i]}cc, transparent)`,
              borderRadius: '4px 4px 0 0',
              opacity: 0, transformOrigin: 'bottom',
              pointerEvents: 'none',
            }} />
          </div>
        ))}
      </div>

      {/* Line + area */}
      <svg style={{ position: 'absolute', left: 38, right: 12, bottom: 34, top: 12 }}
        viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="buildLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#34d399" />
            <stop offset="50%"  stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="buildArea" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path ref={areaRef} d={area} fill="url(#buildArea)" opacity="0" />
        {/* Line */}
        <path ref={lineRef} d={d} fill="none" stroke="url(#buildLine)"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke" opacity="0" />
        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} ref={el => { dotsRef.current[i] = el; }}
            cx={p[0]} cy={p[1]} r="3"
            fill="white" stroke={colors[i]} strokeWidth="1.5"
            opacity="0"
            style={{ filter: `drop-shadow(0 0 5px ${colors[i]})` }}
          />
        ))}
      </svg>

      {/* Particles flying up when bars appear */}
      {active && !barsDone && heights.map((h, i) => (
        Array.from({ length: 3 }).map((_, j) => (
          <div key={`${i}-${j}`} style={{
            position: 'absolute',
            left: `${11 + i * 12.5 + (j - 1) * 3}%`,
            bottom: `${34 + h * 1.5}px`,
            width: 3, height: 3, borderRadius: '50%',
            background: colors[i],
            boxShadow: `0 0 6px ${colors[i]}`,
            animation: `particleUp 0.8s ease-out ${0.1 + i * 0.07 + j * 0.05}s both`,
            pointerEvents: 'none',
          }} />
        ))
      ))}

      <p style={{
        position: 'absolute', bottom: -30, left: 0, right: 0,
        textAlign: 'center', fontSize: 14, color: 'var(--text-tertiary)', margin: 0,
      }}>
        Generando dashboard...
      </p>

      <style>{`
        @keyframes particleUp {
          0%   { transform: translateY(0) scale(1); opacity: 0.9; }
          100% { transform: translateY(-40px) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────
function Steps({ phase }: { phase: number }) {
  const labels = ['Recibiendo', 'Analizando', 'Obteniendo', 'Generando', 'Listo'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {labels.map((label, i) => {
        const active = phase === i + 1;
        const done   = phase > i + 1;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: active ? 12 : 8, height: active ? 12 : 8, borderRadius: '50%',
                background: done ? '#34d399' : active ? 'var(--primary)' : 'var(--surface-3)',
                boxShadow: active ? '0 0 16px var(--primary)' : done ? '0 0 8px #34d399' : 'none',
                transition: 'all 0.3s',
                animation: active ? 'stepPulse 1.2s ease-in-out infinite' : 'none',
              }} />
              <span style={{
                fontSize: 9, fontWeight: active ? 600 : 400,
                color: done ? '#34d399' : active ? 'var(--primary)' : 'var(--text-tertiary)',
                opacity: active || done ? 1 : 0.4,
              }}>{label}</span>
            </div>
            {i < 4 && (
              <div style={{
                width: 28, height: 2, marginBottom: 18,
                background: done ? 'linear-gradient(90deg, #34d399, var(--primary))' : 'var(--surface-3)',
                borderRadius: 1, transition: 'all 0.4s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function BuildingAnimation({ state, query, statusMessage }: Props) {
  const [phase, setPhase] = useState(0);
  const prevPhase = useRef(0);

  useEffect(() => {
    let p = 0;
    if (state === 'QUERY_RECEIVED') p = 1;
    else if (state === 'ANALYZING') p = 2;
    else if (state === 'FETCHING_DATA') p = 3;
    else if (state === 'GENERATING_VISUALIZATIONS') p = 4;
    else if (state === 'REVEAL') p = 5;
    if (p >= prevPhase.current) { setPhase(p); prevPhase.current = p; }
  }, [state]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 36, overflow: 'hidden',
    }}>
      {/* Node canvas — fullscreen, crisp */}
      <NodeCanvas />

      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(var(--border-color) 1px, transparent 1px),
          linear-gradient(90deg, var(--border-color) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        opacity: 0.6,
      }} />

      {/* Center glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 50% at center, var(--primary-light), transparent)',
      }} />

      {/* Query */}
      {query && (
        <p style={{
          position: 'relative', zIndex: 1,
          fontSize: 20, fontWeight: 600, color: 'var(--text)',
          textAlign: 'center', margin: 0, maxWidth: 560, padding: '0 24px',
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          <span style={{ color: 'var(--primary)', opacity: 0.4 }}>"</span>
          {query}
          <span style={{ color: 'var(--primary)', opacity: 0.4 }}>"</span>
        </p>
      )}

      {/* Center stage */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: 360, height: 260,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PhaseSearch active={phase === 1} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PhaseAnalyze active={phase === 2} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PhaseBuild active={phase >= 3} />
        </div>
      </div>

      {/* Steps */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Steps phase={phase} />
      </div>

      {/* Status */}
      {statusMessage && (
        <p style={{
          position: 'relative', zIndex: 1,
          fontSize: 11, color: 'var(--text-tertiary)',
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0,
        }}>
          {statusMessage}
        </p>
      )}

      <style>{`
        @keyframes scanMag {
          0%, 100% { transform: translateY(0px); opacity: 0.9; }
          50%       { transform: translateY(26px); opacity: 0.4; }
        }
        @keyframes stepPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.35); }
        }
      `}</style>
    </div>
  );
}
