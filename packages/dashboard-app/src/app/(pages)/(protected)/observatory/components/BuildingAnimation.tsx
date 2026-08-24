'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import type { ObservatoryState } from '../state-machine';

interface Props {
  state: ObservatoryState;
  query: string | null;
  statusMessage: string;
}

// ── Node canvas ───────────────────────────────────────────
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
      canvas.getContext('2d')!.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#49a4d8';
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const SIDE = 0.28;

    const mkNodes = (side: 'left' | 'right', n: number) =>
      Array.from({ length: n }, () => ({
        x: side === 'left' ? Math.random() * W() * SIDE : W() * (1 - SIDE) + Math.random() * W() * SIDE,
        y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: 1.5 + Math.random() * 2,
      }));

    const nodesL = mkNodes('left', 20);
    const nodesR = mkNodes('right', 20);

    const drawGroup = (ctx: CanvasRenderingContext2D, nodes: typeof nodesL, side: 'left' | 'right') => {
      const threshold = 120;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < threshold) {
            const fade = side === 'left'
              ? Math.min(nodes[i].x, nodes[j].x) / (W() * SIDE)
              : 1 - Math.max(nodes[i].x, nodes[j].x) / W();
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = primary;
            ctx.globalAlpha = (1 - dist / threshold) * 0.25 * Math.max(0, 1 - fade);
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      nodes.forEach(n => {
        const fade = side === 'left' ? 1 - n.x / (W() * SIDE) : (n.x - W() * (1 - SIDE)) / (W() * SIDE);
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
      [...nodesL, ...nodesR].forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W()) n.vx *= -1;
        if (n.y < 0 || n.y > H()) n.vy *= -1;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
}

// ── Phase wrapper ─────────────────────────────────────────
function Phase({ active, children }: { active: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const hasBeenActive = useRef(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!ref.current) return;

    if (active) {
      hasBeenActive.current = true;
      gsap.killTweensOf(ref.current);
      gsap.set(ref.current, { y: 0, scale: 1, filter: 'blur(0px)' });
      if (isFirstRender.current) {
        gsap.set(ref.current, { opacity: 1 });
      } else {
        gsap.fromTo(ref.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, ease: 'power2.out' }
        );
      }
    } else if (hasBeenActive.current) {
      gsap.killTweensOf(ref.current);
      gsap.to(ref.current, { opacity: 0, duration: 0.3, ease: 'power2.in' });
    }

    isFirstRender.current = false;
  }, [active]);
  return (
    <div ref={ref} style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 28, opacity: 0, pointerEvents: 'none',
    }}>
      {children}
    </div>
  );
}

// ── Phase 1: RECIBIENDO — signal pulse ────────────────────
function PhaseReceiving({ active }: { active: boolean }) {
  const ringsRef = useRef<(HTMLDivElement | null)[]>([]);
  const dotRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    // Center dot pulses
    gsap.to(dotRef.current, { scale: 1.3, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    // Rings expand outward with stagger
    ringsRef.current.forEach((el, i) => {
      if (!el) return;
      gsap.fromTo(el,
        { scale: 0.3, opacity: 0.8 },
        { scale: 1.8, opacity: 0, duration: 2, ease: 'power1.out', delay: i * 0.6, repeat: -1 }
      );
    });
    return () => {
      gsap.killTweensOf(dotRef.current);
      ringsRef.current.forEach(el => gsap.killTweensOf(el));
    };
  }, [active]);

  return (
    <Phase active={active}>
      <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} ref={el => { ringsRef.current[i] = el; }} style={{
            position: 'absolute',
            width: 120, height: 120, borderRadius: '50%',
            border: '1.5px solid var(--primary)',
            opacity: 0,
          }} />
        ))}
        <div ref={dotRef} style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'var(--primary)',
          boxShadow: '0 0 32px var(--primary), 0 0 64px var(--primary)',
        }} />
      </div>
      <p style={{ fontSize: 15, color: 'var(--text-tertiary)', margin: 0, letterSpacing: '0.06em' }}>Recibiendo query...</p>
    </Phase>
  );
}

// ── Phase 2: ANALIZANDO — vertical scan ──────────────────
function PhaseAnalyzing({ active }: { active: boolean }) {
  const scanRef  = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const dotRefs  = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    gsap.to(scanRef.current,  { y: 96, duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.to(trailRef.current, { y: 96, duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    dotRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.to(el, { opacity: 1, duration: 0.3, ease: 'power2.out', delay: i * 0.18, yoyo: true, repeat: -1, repeatDelay: 0.4 });
    });
    return () => {
      gsap.killTweensOf(scanRef.current);
      gsap.killTweensOf(trailRef.current);
      dotRefs.current.forEach(el => gsap.killTweensOf(el));
    };
  }, [active]);

  const dots = [
    { x: 30, y: 28 }, { x: 70, y: 45 }, { x: 50, y: 65 },
    { x: 20, y: 60 }, { x: 80, y: 25 }, { x: 55, y: 20 },
  ];

  return (
    <Phase active={active}>
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        {/* Border circle */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1.5px solid var(--primary)',
          boxShadow: '0 0 24px var(--primary)',
          overflow: 'hidden',
        }}>
          {/* Scan line */}
          <div ref={scanRef} style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: 2,
            background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
            boxShadow: '0 0 8px var(--primary)',
          }} />
          {/* Scan glow trail */}
          <div ref={trailRef} style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: 24,
            background: 'linear-gradient(to bottom, rgba(73,164,216,0.15), transparent)',
            pointerEvents: 'none',
          }} />
        </div>
        {/* Dots */}
        {dots.map((d, i) => (
          <div key={i} ref={el => { dotRefs.current[i] = el; }} style={{
            position: 'absolute',
            left: `${d.x}%`, top: `${d.y}%`,
            width: 4, height: 4, borderRadius: '50%',
            background: 'var(--primary)',
            boxShadow: '0 0 6px var(--primary)',
            opacity: 0,
            transform: 'translate(-50%, -50%)',
          }} />
        ))}
      </div>
      <p style={{ fontSize: 15, color: 'var(--text-tertiary)', margin: 0, letterSpacing: '0.06em' }}>Analizando intent...</p>
    </Phase>
  );
}

// ── Phase 3: OBTENIENDO — data stream rows ────────────────
function PhaseFetching({ active }: { active: boolean }) {
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    const rows = rowsRef.current.filter(Boolean) as HTMLDivElement[];
    if (rows.length === 0) return;

    let currentTl: gsap.core.Timeline | null = null;
    let alive = true;

    const loop = () => {
      if (!alive) return;
      // reset
      gsap.set(rows, { width: 0, opacity: 1 });
      currentTl = gsap.timeline({ onComplete: loop });
      rows.forEach((el, i) => {
        const targetW = el.dataset.w ?? '80%';
        currentTl!.to(el, { width: targetW, duration: 0.4, ease: 'power2.out' }, i * 0.1);
      });
      currentTl.to(rows, { opacity: 0, duration: 0.4, stagger: 0.05 }, '+=0.8');
    };
    loop();

    return () => { alive = false; currentTl?.kill(); };
  }, [active]);

  const rows = [
    { w: '85%' }, { w: '60%' }, { w: '75%' },
    { w: '45%' }, { w: '90%' }, { w: '55%' }, { w: '70%' },
  ];

  return (
    <Phase active={active}>
      <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 6px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Dataset · ventas-credito</p>
        {rows.map((r, i) => (
          <div key={i} ref={el => { rowsRef.current[i] = el; }}
            data-w={r.w}
            style={{
              height: 10, width: 0, borderRadius: 5,
              background: i % 2 === 0 ? 'var(--primary)' : 'var(--primary-dark)',
              boxShadow: i % 2 === 0 ? '0 0 10px var(--primary)' : '0 0 10px var(--primary-dark)',
              opacity: 1,
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: 15, color: 'var(--text-tertiary)', margin: 0, letterSpacing: '0.06em' }}>Obteniendo datos...</p>
    </Phase>
  );
}

// ── Phase 4: GENERANDO — chart building ──────────────────
function PhaseGenerating({ active }: { active: boolean }) {
  const barsRef  = useRef<(HTMLDivElement | null)[]>([]);
  const glowsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef  = useRef<SVGPathElement>(null);
  const areaRef  = useRef<SVGPathElement>(null);
  const dotsRef  = useRef<(SVGCircleElement | null)[]>([]);

  const heights = [42, 74, 36, 88, 54, 92, 46, 72];
  const colors  = [
    'var(--primary)', '#2d88bf', 'var(--primary)', '#2d88bf',
    'var(--primary)', '#2d88bf', 'var(--primary)', '#2d88bf',
  ];
  const pts     = heights.map((h, i) => [7 + i * 12.5, 94 - h * 0.86]);
  const d       = `M ${pts.map(p => p.join(' ')).join(' L ')}`;
  const area    = `${d} L ${pts[pts.length-1][0]} 94 L ${pts[0][0]} 94 Z`;

  useEffect(() => {
    if (!active) return;
    const tl = gsap.timeline();

    // Bars grow
    barsRef.current.forEach((el, i) => {
      if (!el) return;
      tl.fromTo(el, { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.5)', transformOrigin: 'bottom' }, 0.1 + i * 0.07);
    });
    // Flash glow
    glowsRef.current.forEach((el, i) => {
      if (!el) return;
      tl.fromTo(el, { opacity: 0.9, scaleY: 1.4 }, { opacity: 0, scaleY: 1, duration: 0.4, ease: 'power2.out', transformOrigin: 'bottom' }, 0.1 + i * 0.07 + 0.3);
    });
    // Line
    if (lineRef.current && areaRef.current) {
      const len = lineRef.current.getTotalLength();
      gsap.set(lineRef.current, { strokeDasharray: len, strokeDashoffset: len, opacity: 0 });
      gsap.set(areaRef.current, { opacity: 0 });
      tl.to(lineRef.current, { strokeDashoffset: 0, opacity: 1, duration: 1.2, ease: 'power2.inOut' }, 0.9);
      tl.to(areaRef.current, { opacity: 1, duration: 0.7, ease: 'power2.out' }, 1.5);
    }
    // Dots
    dotsRef.current.forEach((el, i) => {
      if (!el) return;
      tl.fromTo(el, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(3)' }, 1.7 + i * 0.07);
    });

    return () => tl.kill();
  }, [active]);

  return (
    <Phase active={active}>
      <div style={{ width: 460, height: 260, position: 'relative' }}>
        {/* Axes */}
        <div style={{ position: 'absolute', left: 32, top: 8, bottom: 32, width: 2, background: 'linear-gradient(to top, var(--primary), var(--primary-light))', borderRadius: 1, boxShadow: '0 0 8px var(--primary)' }} />
        <div style={{ position: 'absolute', left: 32, right: 8, bottom: 32, height: 2, background: 'linear-gradient(to right, var(--primary), var(--primary-light))', borderRadius: 1, boxShadow: '0 0 8px var(--primary)' }} />
        {/* Grid */}
        {[0.3, 0.55, 0.8].map((y, i) => (
          <div key={i} style={{ position: 'absolute', left: 34, right: 8, bottom: `${32 + y * 200}px`, height: 1, background: 'var(--border-color)', opacity: 0.4 }} />
        ))}
        {/* Bars */}
        <div style={{ position: 'absolute', left: 38, right: 12, bottom: 34, top: 10, display: 'flex', alignItems: 'flex-end', gap: '3%' }}>
          {heights.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, position: 'relative' }}>
              <div ref={el => { barsRef.current[i] = el; }} style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${colors[i]}, ${colors[i]}44)`, borderRadius: '4px 4px 0 0', boxShadow: `0 0 12px ${colors[i]}55`, transform: 'scaleY(0)', transformOrigin: 'bottom' }} />
              <div ref={el => { glowsRef.current[i] = el; }} style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${colors[i]}cc, transparent)`, borderRadius: '4px 4px 0 0', opacity: 0, transformOrigin: 'bottom', pointerEvents: 'none' }} />
            </div>
          ))}
        </div>
        {/* Line + area */}
        <svg style={{ position: 'absolute', left: 38, right: 12, bottom: 34, top: 10 }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gl" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#49a4d8" />
              <stop offset="50%" stopColor="#2d88bf" />
              <stop offset="100%" stopColor="#49a4d8" />
            </linearGradient>
            <linearGradient id="ga" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#49a4d8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#49a4d8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path ref={areaRef} d={area} fill="url(#ga)" opacity="0" />
          <path ref={lineRef} d={d} fill="none" stroke="url(#gl)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity="0" />
          {pts.map((p, i) => (
            <circle key={i} ref={el => { dotsRef.current[i] = el; }} cx={p[0]} cy={p[1]} r="3" fill="white" stroke="#49a4d8" strokeWidth="1.5" opacity="0" style={{ filter: 'drop-shadow(0 0 4px #49a4d8)' }} />
          ))}
        </svg>
      </div>
      <p style={{ fontSize: 15, color: 'var(--text-tertiary)', margin: 0, letterSpacing: '0.06em' }}>Generando dashboard...</p>
    </Phase>
  );
}

// ── Phase 5: LISTO — checkmark ────────────────────────────
function PhaseReady({ active }: { active: boolean }) {
  const checkRef  = useRef<SVGPathElement>(null);
  const circleRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (!active) return;
    if (!checkRef.current || !circleRef.current) return;

    const circleLen = circleRef.current.getTotalLength();
    const checkLen  = checkRef.current.getTotalLength();

    gsap.set(circleRef.current, { strokeDasharray: circleLen, strokeDashoffset: circleLen });
    gsap.set(checkRef.current,  { strokeDasharray: checkLen,  strokeDashoffset: checkLen });

    const tl = gsap.timeline();
    tl.to(circleRef.current, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' });
    tl.to(checkRef.current,  { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out' }, '-=0.1');

    return () => tl.kill();
  }, [active]);

  return (
    <Phase active={active}>
      <svg width="120" height="120" viewBox="0 0 80 80" style={{ overflow: 'visible', filter: 'drop-shadow(0 0 20px rgba(52,211,153,0.5))' }}>
        <circle ref={circleRef} cx="40" cy="40" r="32" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
        <path ref={checkRef} d="M 24 40 L 35 52 L 56 28" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#34d399', margin: 0, letterSpacing: '0.04em', textShadow: '0 0 16px rgba(52,211,153,0.4)' }}>¡Dashboard listo!</p>
    </Phase>
  );
}

// ── Steps ─────────────────────────────────────────────────
function Steps({ phase }: { phase: number }) {
  const steps = [
    { label: 'Recibiendo', icon: '◈' },
    { label: 'Analizando', icon: '◎' },
    { label: 'Obteniendo', icon: '⬡' },
    { label: 'Generando',  icon: '◇' },
    { label: 'Listo',      icon: '✦' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map(({ label, icon }, i) => {
        const active = phase === i + 1;
        const done   = phase > i + 1;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Step */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 72 }}>
              <div style={{
                width: active ? 36 : 28, height: active ? 36 : 28,
                borderRadius: '50%',
                background: done
                  ? 'linear-gradient(135deg, #34d399, #06b6d4)'
                  : active
                    ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))'
                    : 'var(--surface-3)',
                border: active ? '2px solid var(--primary-light)' : done ? 'none' : '1px solid var(--border-color)',
                boxShadow: active ? '0 0 20px var(--primary), 0 0 40px var(--primary-light)' : done ? '0 0 10px #34d39966' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                fontSize: active ? 14 : 11,
                color: done || active ? '#fff' : 'var(--text-tertiary)',
                animation: active ? 'stepPulse 2s ease-in-out infinite' : 'none',
              }}>
                {done ? '✓' : icon}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 400,
                color: done ? '#34d399' : active ? 'var(--primary)' : 'var(--text-tertiary)',
                opacity: active || done ? 1 : 0.4,
                letterSpacing: '0.04em',
                transition: 'all 0.3s',
                whiteSpace: 'nowrap',
              }}>{label}</span>
            </div>
            {/* Connector */}
            {i < 4 && (
              <div style={{
                width: 40, height: 2, marginBottom: 22, flexShrink: 0,
                background: done
                  ? 'linear-gradient(90deg, #34d399, var(--primary))'
                  : 'var(--surface-3)',
                borderRadius: 1,
                transition: 'background 0.5s ease',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Animated fill for active connector */}
                {phase === i + 2 && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(90deg, #34d399, var(--primary))',
                    animation: 'connectorFill 0.5s ease-out forwards',
                  }} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
function stateToPhase(state: ObservatoryState): number {
  if (state === 'QUERY_RECEIVED') return 1;
  if (state === 'ANALYZING') return 2;
  if (state === 'FETCHING_DATA') return 3;
  if (state === 'GENERATING_VISUALIZATIONS') return 4;
  if (state === 'REVEAL') return 5;
  return 0;
}

export default function BuildingAnimation({ state, query, statusMessage }: Props) {
  const [phase, setPhase] = useState(() => stateToPhase(state));
  const prevPhase = useRef(stateToPhase(state));

  useEffect(() => {
    const p = stateToPhase(state);
    if (p >= prevPhase.current) { setPhase(p); prevPhase.current = p; }
  }, [state]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      <NodeCanvas />

      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(var(--border-color) 1px, transparent 1px), linear-gradient(90deg, var(--border-color) 1px, transparent 1px)`,
        backgroundSize: '60px 60px', opacity: 0.5,
      }} />

      {/* Center glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 60% at center, var(--primary-light), transparent)' }} />

      {/* Query — fixed top */}
      {query && (
        <p style={{
          position: 'absolute', top: 'clamp(32px, 6vh, 64px)', left: 0, right: 0,
          zIndex: 1, textAlign: 'center', margin: 0,
          fontSize: 'clamp(16px, 2vw, 22px)', fontWeight: 600, color: 'var(--text)',
          padding: '0 24px',
          opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          <span style={{ color: 'var(--primary)', opacity: 0.4 }}>“</span>{query}<span style={{ color: 'var(--primary)', opacity: 0.4 }}>”</span>
        </p>
      )}

      {/* Phase stage — absolutely centered */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(700px, 90vw)',
        height: 'clamp(300px, 45vh, 480px)',
        zIndex: 1,
      }}>
        <PhaseReceiving  active={phase === 1} />
        <PhaseAnalyzing  active={phase === 2} />
        <PhaseFetching   active={phase === 3} />
        <PhaseGenerating active={phase === 4} />
        <PhaseReady      active={phase === 5} />
      </div>

      {/* Steps — fixed bottom */}
      <div style={{ position: 'absolute', bottom: 'clamp(32px, 6vh, 64px)', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
        <Steps phase={phase} />
      </div>

      {statusMessage && (
        <p style={{
          position: 'absolute', bottom: 'clamp(12px, 2vh, 20px)', left: 0, right: 0,
          textAlign: 'center', zIndex: 1,
          fontSize: 11, color: 'var(--primary)',
          letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0,
          opacity: 0.7,
        }}>
          {statusMessage}
        </p>
      )}

      <style>{`
        @keyframes stepPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px var(--primary), 0 0 40px var(--primary-light); }
          50%       { transform: scale(1.1); box-shadow: 0 0 30px var(--primary), 0 0 60px var(--primary-light); }
        }
        @keyframes connectorFill {
          from { transform: scaleX(0); transform-origin: left; }
          to   { transform: scaleX(1); transform-origin: left; }
        }
      `}</style>
    </div>
  );
}
