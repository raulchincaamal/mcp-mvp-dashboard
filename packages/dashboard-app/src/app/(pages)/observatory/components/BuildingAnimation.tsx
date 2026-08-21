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
  useEffect(() => {
    if (!ref.current) return;
    if (active) {
      gsap.fromTo(ref.current, { opacity: 0, y: 24, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'power3.out' });
    } else {
      gsap.to(ref.current, { opacity: 0, y: -16, scale: 0.95, duration: 0.3, ease: 'power2.in' });
    }
  }, [active]);
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, opacity: 0, pointerEvents: 'none' }}>
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
            width: 80, height: 80, borderRadius: '50%',
            border: '1.5px solid var(--primary)',
            opacity: 0,
          }} />
        ))}
        <div ref={dotRef} style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--primary)',
          boxShadow: '0 0 24px var(--primary), 0 0 48px var(--primary)',
        }} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0, letterSpacing: '0.06em' }}>Recibiendo query...</p>
    </Phase>
  );
}

// ── Phase 2: ANALIZANDO — scanning magnifier ──────────────
function PhaseAnalyzing({ active }: { active: boolean }) {
  const glassRef = useRef<HTMLDivElement>(null);
  const scanRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    gsap.to(glassRef.current, { x: 20, y: -14, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.to(scanRef.current, { y: 30, duration: 1.0, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    return () => { gsap.killTweensOf(glassRef.current); gsap.killTweensOf(scanRef.current); };
  }, [active]);

  return (
    <Phase active={active}>
      <div ref={glassRef} style={{ position: 'relative', width: 90, height: 90 }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 66, height: 66, borderRadius: '50%',
          border: '3px solid var(--primary)',
          boxShadow: '0 0 24px var(--primary), inset 0 0 16px rgba(73,164,216,0.1)',
        }} />
        <div style={{
          position: 'absolute', top: 8, left: 8, width: 50, height: 50, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(73,164,216,0.1) 0%, transparent 70%)',
        }} />
        <div ref={scanRef} style={{
          position: 'absolute', top: 16, left: 10, right: 16, height: 2,
          background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
          boxShadow: '0 0 8px var(--primary)', borderRadius: 1,
        }} />
        <div style={{
          position: 'absolute', bottom: 2, right: 2, width: 3, height: 32, borderRadius: 2,
          background: 'linear-gradient(to bottom, var(--primary), var(--primary-dark))',
          transform: 'rotate(45deg)', transformOrigin: 'top center',
          boxShadow: '0 0 8px var(--primary)',
        }} />
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0, letterSpacing: '0.06em' }}>Analizando intent...</p>
    </Phase>
  );
}

// ── Phase 3: OBTENIENDO — data stream rows ────────────────
function PhaseFetching({ active }: { active: boolean }) {
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
    rowsRef.current.forEach((el, i) => {
      if (!el) return;
      tl.fromTo(el,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.35, ease: 'power2.out', transformOrigin: 'left' },
        i * 0.08
      );
    });
    tl.to(rowsRef.current, { opacity: 0, duration: 0.3, stagger: 0.04 }, '+=0.5');
    return () => tl.kill();
  }, [active]);

  const rows = [
    { w: '85%', color: '#06b6d4' }, { w: '60%', color: '#34d399' },
    { w: '75%', color: '#a78bfa' }, { w: '45%', color: '#f472b6' },
    { w: '90%', color: '#06b6d4' }, { w: '55%', color: '#34d399' },
    { w: '70%', color: '#a78bfa' },
  ];

  return (
    <Phase active={active}>
      <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Dataset · ventas-credito</p>
        {rows.map((r, i) => (
          <div key={i} ref={el => { rowsRef.current[i] = el; }} style={{
            height: 8, width: r.w, borderRadius: 4,
            background: `linear-gradient(90deg, ${r.color}, ${r.color}44)`,
            boxShadow: `0 0 8px ${r.color}66`,
            opacity: 0,
          }} />
        ))}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0, letterSpacing: '0.06em' }}>Obteniendo datos...</p>
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
  const colors  = ['#7c6fff','#06b6d4','#34d399','#f472b6','#fb923c','#a78bfa','#38bdf8','#4ade80'];
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
      <div style={{ width: 320, height: 200, position: 'relative' }}>
        {/* Axes */}
        <div style={{ position: 'absolute', left: 28, top: 8, bottom: 28, width: 2, background: 'linear-gradient(to top, var(--primary), var(--primary-light))', borderRadius: 1, boxShadow: '0 0 8px var(--primary)' }} />
        <div style={{ position: 'absolute', left: 28, right: 8, bottom: 28, height: 2, background: 'linear-gradient(to right, var(--primary), var(--primary-light))', borderRadius: 1, boxShadow: '0 0 8px var(--primary)' }} />
        {/* Grid */}
        {[0.3, 0.55, 0.8].map((y, i) => (
          <div key={i} style={{ position: 'absolute', left: 30, right: 8, bottom: `${28 + y * 150}px`, height: 1, background: 'var(--border-color)', opacity: 0.4 }} />
        ))}
        {/* Bars */}
        <div style={{ position: 'absolute', left: 34, right: 10, bottom: 30, top: 10, display: 'flex', alignItems: 'flex-end', gap: '3%' }}>
          {heights.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, position: 'relative' }}>
              <div ref={el => { barsRef.current[i] = el; }} style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${colors[i]}, ${colors[i]}44)`, borderRadius: '4px 4px 0 0', boxShadow: `0 0 12px ${colors[i]}55`, transform: 'scaleY(0)', transformOrigin: 'bottom' }} />
              <div ref={el => { glowsRef.current[i] = el; }} style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${colors[i]}cc, transparent)`, borderRadius: '4px 4px 0 0', opacity: 0, transformOrigin: 'bottom', pointerEvents: 'none' }} />
            </div>
          ))}
        </div>
        {/* Line + area */}
        <svg style={{ position: 'absolute', left: 34, right: 10, bottom: 30, top: 10 }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gl" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" /><stop offset="50%" stopColor="#06b6d4" /><stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <linearGradient id="ga" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" /><stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path ref={areaRef} d={area} fill="url(#ga)" opacity="0" />
          <path ref={lineRef} d={d} fill="none" stroke="url(#gl)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity="0" />
          {pts.map((p, i) => (
            <circle key={i} ref={el => { dotsRef.current[i] = el; }} cx={p[0]} cy={p[1]} r="3" fill="white" stroke={colors[i]} strokeWidth="1.5" opacity="0" style={{ filter: `drop-shadow(0 0 4px ${colors[i]})` }} />
          ))}
        </svg>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0, letterSpacing: '0.06em' }}>Generando dashboard...</p>
    </Phase>
  );
}

// ── Phase 5: LISTO — checkmark ────────────────────────────
function PhaseReady({ active }: { active: boolean }) {
  const checkRef  = useRef<SVGPathElement>(null);
  const circleRef = useRef<SVGCircleElement>(null);
  const glowRef   = useRef<HTMLDivElement>(null);

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
    tl.fromTo(glowRef.current, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, '-=0.2');
    tl.to(glowRef.current, { opacity: 0.4, scale: 1.4, duration: 1.2, ease: 'power1.inOut', yoyo: true, repeat: -1 }, '+=0.1');

    return () => tl.kill();
  }, [active]);

  return (
    <Phase active={active}>
      <div style={{ position: 'relative', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div ref={glowRef} style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.3) 0%, transparent 70%)', opacity: 0 }} />
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle ref={circleRef} cx="40" cy="40" r="32" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px #34d399)' }} />
          <path ref={checkRef} d="M 24 40 L 35 52 L 56 28" fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px #34d399)' }} />
        </svg>
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#34d399', margin: 0, letterSpacing: '0.04em', textShadow: '0 0 16px #34d39966' }}>¡Dashboard listo!</p>
    </Phase>
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
              <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: done ? '#34d399' : active ? 'var(--primary)' : 'var(--text-tertiary)', opacity: active || done ? 1 : 0.4 }}>{label}</span>
            </div>
            {i < 4 && (
              <div style={{ width: 28, height: 2, marginBottom: 18, background: done ? 'linear-gradient(90deg, #34d399, var(--primary))' : 'var(--surface-3)', borderRadius: 1, transition: 'all 0.4s' }} />
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
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, overflow: 'hidden' }}>
      <NodeCanvas />

      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(var(--border-color) 1px, transparent 1px), linear-gradient(90deg, var(--border-color) 1px, transparent 1px)`,
        backgroundSize: '60px 60px', opacity: 0.5,
      }} />

      {/* Center glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 50% 50% at center, var(--primary-light), transparent)' }} />

      {/* Query */}
      {query && (
        <p style={{
          position: 'relative', zIndex: 1, fontSize: 20, fontWeight: 600, color: 'var(--text)',
          textAlign: 'center', margin: 0, maxWidth: 560, padding: '0 24px',
          opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          <span style={{ color: 'var(--primary)', opacity: 0.4 }}>"</span>{query}<span style={{ color: 'var(--primary)', opacity: 0.4 }}>"</span>
        </p>
      )}

      {/* Phase stage */}
      <div style={{ position: 'relative', zIndex: 1, width: 360, height: 260 }}>
        <PhaseReceiving  active={phase === 1} />
        <PhaseAnalyzing  active={phase === 2} />
        <PhaseFetching   active={phase === 3} />
        <PhaseGenerating active={phase === 4} />
        <PhaseReady      active={phase === 5} />
      </div>

      {/* Steps */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Steps phase={phase} />
      </div>

      {statusMessage && (
        <p style={{ position: 'relative', zIndex: 1, fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
          {statusMessage}
        </p>
      )}

      <style>{`
        @keyframes stepPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.35); }
        }
      `}</style>
    </div>
  );
}
