'use client';

import { useRef, useEffect } from 'react';
import React from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { cursorRef } from '../hooks/useCursor';

interface Props {
  onCategoryClick?: (label: string, rect: DOMRect) => void;
}

const CATEGORY_SVGS: Record<string, string> = {
  Motos: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="34" r="6" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="38" cy="34" r="6" stroke="white" stroke-width="2.5" fill="none"/>
    <path d="M16 34 L20 22 L28 22 L32 28 L38 28" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M20 22 L24 14 L30 14 L32 22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M10 28 L16 34" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <path d="M30 14 L36 14 L38 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="22" y="18" width="8" height="5" rx="1" stroke="white" stroke-width="1.5" fill="none" opacity="0.6"/>
  </svg>`,
  Celulares: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="6" width="20" height="36" rx="4" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="24" cy="38" r="2" fill="white" opacity="0.7"/>
    <line x1="19" y1="12" x2="29" y2="12" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  </svg>`,
  'Bicicletas Eléctricas': `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="34" r="7" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="36" cy="34" r="7" stroke="white" stroke-width="2.5" fill="none"/>
    <path d="M19 20 L12 34" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <path d="M19 20 L36 34" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <path d="M19 20 L26 14 L32 14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="19" cy="20" r="2" fill="white" opacity="0.8"/>
    <path d="M28 8 L32 8 L30 12 L34 12" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
  </svg>`,
  'Pantallas/TV': `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="10" width="36" height="24" rx="3" stroke="white" stroke-width="2.5" fill="none"/>
    <line x1="18" y1="34" x2="30" y2="34" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="24" y1="34" x2="24" y2="40" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="16" y1="40" x2="32" y2="40" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  Audio: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 24 C10 15 17 8 24 8 C31 8 38 15 38 24" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <rect x="7" y="24" width="7" height="11" rx="3" stroke="white" stroke-width="2.5" fill="none"/>
    <rect x="34" y="24" width="7" height="11" rx="3" stroke="white" stroke-width="2.5" fill="none"/>
  </svg>`,
  Tablets: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="6" width="28" height="36" rx="4" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="24" cy="38" r="2" fill="white" opacity="0.7"/>
    <rect x="15" y="12" width="18" height="20" rx="2" stroke="white" stroke-width="1.5" fill="none" opacity="0.5"/>
  </svg>`,
  Consolas: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="16" width="36" height="20" rx="8" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="32" cy="24" r="2.5" fill="white" opacity="0.8"/>
    <circle cx="38" cy="24" r="2.5" fill="white" opacity="0.8"/>
    <line x1="14" y1="22" x2="14" y2="28" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="11" y1="25" x2="17" y2="25" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  'Climatización': `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="12" width="36" height="16" rx="4" stroke="white" stroke-width="2.5" fill="none"/>
    <line x1="6" y1="20" x2="42" y2="20" stroke="white" stroke-width="1.5" opacity="0.4"/>
    <path d="M12 28 L10 36 M18 28 L16 36 M24 28 L24 36 M30 28 L32 36 M36 28 L38 36" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <circle cx="35" cy="16" r="2.5" fill="white" opacity="0.8"/>
  </svg>`,
};

const N = 8;
const CATEGORIES = ['Motos', 'Celulares', 'Bicicletas Eléctricas', 'Pantallas/TV', 'Audio', 'Tablets', 'Consolas', 'Climatización'];

// Aurora accent per category
const AURORA_COLORS: Record<string, string> = {
  Motos:                  '#7c6fff',
  Celulares:              '#06b6d4',
  'Bicicletas Eléctricas': '#34d399',
  'Pantallas/TV':         '#f472b6',
  Audio:                  '#fb923c',
  Tablets:                '#a78bfa',
  Consolas:               '#38bdf8',
  'Climatización':        '#4ade80',
};

// Elipse 3D — eje X horizontal, eje Y inclinado
const RX   = 480;   // radio horizontal amplio para evitar solapamiento
const RY   = 140;   // radio vertical para efecto 3D más pronunciado
const TILT = 0.5;   // inclinación del plano (~28°) para mejor perspectiva 3D

// Velocidad orbital: una vuelta completa cada ~50s
const OMEGA = (2 * Math.PI) / (50 * 60); // rad/frame a 60fps

// Separación angular uniforme: 2π/8 = 45°
const DELTA_ANGLE = (2 * Math.PI) / N;

const WIDGET_SIZE = 110;
const CARD_H      = 120;
const LABEL_H     = 24;
const hoverScales = new Array(N).fill(1);
const splashScales = new Array(N).fill(1);
const splashOpacities = new Array(N).fill(1);
const lineProgresses = new Array(N).fill(0); // 0 = at center, 1 = full line
const omegaSpeed  = { v: OMEGA };
const cardVisible = new Array(N).fill(false);

// ── Data ───────────────────────────────────────────────────
const MOCK_VALUES: Record<string, number> = {
  Motos: 1243, Celulares: 876, 'Bicicletas Eléctricas': 312,
  'Pantallas/TV': 541, Audio: 198, Tablets: 423, Consolas: 267, 'Climatización': 389,
};
const MOCK_CHANGE: Record<string, number> = {
  Motos: 4.2, Celulares: -1.8, 'Bicicletas Eléctricas': 7.1,
  'Pantallas/TV': -0.5, Audio: 2.3, Tablets: -3.1, Consolas: 5.8, 'Climatización': 1.4,
};

// ── Ticker hook ──────────────────────────────────────────
function useTicker(label: string) {
  const target = MOCK_VALUES[label] ?? 100;
  const [display, setDisplay] = React.useState(Math.max(0, target - Math.ceil(target * 0.08)));
  const [dir, setDir] = React.useState<'up' | 'down' | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    let current = Math.max(0, target - Math.ceil(target * 0.08));
    const step = Math.max(1, Math.ceil((target - current) / 20));
    const tick = () => {
      current = Math.min(target, current + step);
      setDir(current < target ? 'up' : null);
      setDisplay(current);
      if (current < target) { timerRef.current = setTimeout(tick, 35); }
      else {
        let b = 0;
        const bounce = () => {
          if (b >= 6) { setDir(null); setDisplay(target); return; }
          const d = Math.ceil(target * 0.005) || 1;
          const up = b % 2 === 0;
          setDir(up ? 'up' : 'down');
          setDisplay(target + (up ? d : -d));
          b++;
          timerRef.current = setTimeout(bounce, 120);
        };
        timerRef.current = setTimeout(bounce, 60);
      }
    };
    timerRef.current = setTimeout(tick, 300 + Math.random() * 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [target]);

  return { display, dir };
}

function WidgetCard({ label, accent }: { label: string; accent: string }) {
  const { display } = useTicker(label);
  const pct   = MOCK_CHANGE[label] ?? 0;
  const isUp  = pct >= 0;
  const pctCol = isUp ? '#34d399' : '#f87171';

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '12px',
      boxSizing: 'border-box',
      position: 'relative', zIndex: 1,
      gap: 6,
    }}>
      {/* Watermark icon — oversized decorative background */}
      <div
        className="widget-icon"
        style={{
          position: 'absolute',
          bottom: -30, right: -45,
          width: 140, height: 140,
          opacity: 0.12,
          pointerEvents: 'none',
          filter: `drop-shadow(0 0 12px ${accent})`,
        }}
        dangerouslySetInnerHTML={{ __html: CATEGORY_SVGS[label] }}
      />

      {/* Number */}
      <span style={{
        fontSize: 24, fontWeight: 700, color: '#fff',
        letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums',
        lineHeight: 1, textAlign: 'center',
        position: 'relative', zIndex: 2,
      }}>
        {Math.round(display).toLocaleString('es-MX')}
      </span>

      {/* % pill */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        background: isUp ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)',
        borderRadius: 100, padding: '3px 9px',
        position: 'relative', zIndex: 2,
      }}>
        <span style={{ fontSize: 9, color: pctCol, lineHeight: 1 }}>{isUp ? '↑' : '↓'}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: pctCol, lineHeight: 1 }}>
          {isUp ? '+' : ''}{pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default function AmbientBackground({ onCategoryClick }: Props) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const rafRef      = useRef<number>(0);
  const widgetRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const angleRef    = useRef(0);
  const lineGeosRef = useRef<THREE.BufferGeometry[]>([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 2000);
    camera.position.set(0, 0, 650);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Particles ──────────────────────────────────────────────────────────
    const PC = 700;
    const pPos = new Float32Array(PC * 3);
    const pVel: { x: number; y: number }[] = [];
    for (let i = 0; i < PC; i++) {
      pPos[i * 3]     = (Math.random() - 0.5) * 1400;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 900;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 300;
      pVel.push({ x: (Math.random() - 0.5) * 0.12, y: (Math.random() - 0.5) * 0.12 });
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    scene.add(new THREE.Points(pGeo,
      new THREE.PointsMaterial({ color: 0x8899ff, size: 1.6, transparent: true, opacity: 0.4 })
    ));

    // ── Particle connections ───────────────────────────────────────────────
    const MAX_CONN = 500;
    const connPos = new Float32Array(MAX_CONN * 6);
    const connGeo = new THREE.BufferGeometry();
    connGeo.setAttribute('position', new THREE.BufferAttribute(connPos, 3));
    scene.add(new THREE.LineSegments(connGeo,
      new THREE.LineBasicMaterial({ color: 0x4455bb, transparent: true, opacity: 0.15 })
    ));

    // ── Orbit ellipse guide ────────────────────────────────────────────────
    const epts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      epts.push(new THREE.Vector3(
        RX * Math.cos(a),
        RY * Math.sin(a) * Math.cos(TILT),
        RY * Math.sin(a) * Math.sin(TILT),
      ));
    }
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(epts),
      new THREE.LineBasicMaterial({ color: 0x3355ff, transparent: true, opacity: 0.07 }),
    ));

    // ── Center→widget lines ────────────────────────────────────────────────
    const lineGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < N; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      scene.add(new THREE.Line(geo,
        new THREE.LineBasicMaterial({ color: 0x5577ff, transparent: true, opacity: 0.22 }),
      ));
      lineGeos.push(geo);
    }
    lineGeosRef.current = lineGeos;

    // ── Resize ─────────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // ── Loop ───────────────────────────────────────────────────────────────
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const cur = cursorRef.current;
      // Camera follows cursor gently
      camera.position.x += (cur.normalizedX * -25 - camera.position.x) * 0.04;
      camera.position.y += (cur.normalizedY *  18 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      // Advance orbit angle — speed controlled by omegaSpeed.v
      angleRef.current += omegaSpeed.v;

      // Particles
      const pp = pGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < PC; i++) {
        let x = pp.getX(i) + pVel[i].x;
        let y = pp.getY(i) + pVel[i].y;
        if (x >  700) x = -700; if (x < -700) x =  700;
        if (y >  450) y = -450; if (y < -450) y =  450;
        pp.setXYZ(i, x, y, pp.getZ(i));
      }
      pp.needsUpdate = true;

      // Particle connections
      let ci = 0;
      const cp = connGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < PC && ci < MAX_CONN; i++) {
        for (let j = i + 1; j < PC && ci < MAX_CONN; j++) {
          const dx = pp.getX(i) - pp.getX(j);
          const dy = pp.getY(i) - pp.getY(j);
          if (dx * dx + dy * dy < 85 * 85) {
            cp.setXYZ(ci * 2,     pp.getX(i), pp.getY(i), pp.getZ(i));
            cp.setXYZ(ci * 2 + 1, pp.getX(j), pp.getY(j), pp.getZ(j));
            ci++;
          }
        }
      }
      for (let i = ci; i < MAX_CONN; i++) {
        cp.setXYZ(i * 2, 0, 0, -9999); cp.setXYZ(i * 2 + 1, 0, 0, -9999);
      }
      cp.needsUpdate = true;

      // Widgets — GSAP 3D billboard (always flat, facing viewer)
      for (let i = 0; i < N; i++) {
        const a  = angleRef.current + i * DELTA_ANGLE;
        const wx = RX * Math.cos(a);
        const wy = RY * Math.sin(a) * Math.cos(TILT);
        const wz = RY * Math.sin(a) * Math.sin(TILT);

        // Project to screen
        const v = new THREE.Vector3(wx, wy, wz);
        v.project(camera);
        const sx = ( v.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;

        // Depth: 0 = back, 1 = front
        const depth = (wz + RY) / (2 * RY);
        
        // Scale based on depth (3D effect)
        const scale = (0.65 + depth * 0.35) * hoverScales[i];

        const el = widgetRefs.current[i];
        if (el) {
          const totalH = CARD_H + LABEL_H;
          const depth = (wz + RY) / (2 * RY);
          const baseScale = (0.65 + depth * 0.35) * hoverScales[i];

          gsap.set(el, {
            x: sx - WIDGET_SIZE / 2,
            y: sy - totalH / 2,
            zIndex: Math.round(depth * 100) + 10,
            opacity: (0.4 + depth * 0.6) * splashOpacities[i],
            scale: baseScale * splashScales[i],
            visibility: cardVisible[i] ? 'visible' : 'hidden',
          });
        }

        // Update line — interpolate from center to widget based on lineProgresses[i]
        const lg = lineGeosRef.current[i];
        if (lg) {
          const lp = lg.attributes.position as THREE.BufferAttribute;
          const p = lineProgresses[i];
          lp.setXYZ(0, 0, 0, 0);
          lp.setXYZ(1, wx * p, wy * p, wz * p);
          lp.needsUpdate = true;
          // fade in opacity with progress
          (lg as any)._mat = (lg as any)._mat;
          const lineMesh = scene.children.find(c =>
            c instanceof THREE.Line && (c as THREE.Line).geometry === lg
          ) as THREE.Line | undefined;
          if (lineMesh) (lineMesh.material as THREE.LineBasicMaterial).opacity = 0.22 * p;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Wait for RAF to complete one full orbit calculation before animating in
    let framesReady = 0;
    const waitForPosition = () => {
      framesReady++;
      if (framesReady < 3) {
        requestAnimationFrame(waitForPosition);
        return;
      }
      // Cards are positioned — reset splash values and animate in
      for (let i = 0; i < N; i++) {
        splashScales[i] = 0;
        splashOpacities[i] = 0;
      }
      // Make visible now that positions are set
      widgetRefs.current.forEach((el, i) => {
        if (el) gsap.set(el, { visibility: 'visible' });
        cardVisible[i] = true;
      });
      const tl = gsap.timeline();
      for (let i = 0; i < N; i++) {
        tl.to(splashScales,    { [i]: 1, duration: 0.6, ease: 'back.out(1.6)' }, i * 0.08);
        tl.to(splashOpacities, { [i]: 1, duration: 0.5, ease: 'power2.out'    }, i * 0.08);
        tl.to(lineProgresses,  { [i]: 1, duration: 0.8, ease: 'power3.out'    }, i * 0.08 + 0.1);
      }
    };
    requestAnimationFrame(waitForPosition);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {CATEGORIES.map((label, i) => {
        const accent = AURORA_COLORS[label];
        return (
        <div
          key={label}
          ref={el => { widgetRefs.current[i] = el; }}
          style={{
            position: 'absolute',
            width: WIDGET_SIZE,
            cursor: 'pointer', pointerEvents: 'auto',
            userSelect: 'none',
            willChange: 'transform',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            visibility: 'hidden',
          }}
          onClick={e => onCategoryClick?.(label, e.currentTarget.getBoundingClientRect())}
          onMouseEnter={e => {
            const el = e.currentTarget;
            gsap.to(omegaSpeed, { v: 0, duration: 1.2, ease: 'power3.out', overwrite: true });
            gsap.to(hoverScales, { [i]: 1.08, duration: 0.5, ease: 'power2.out', overwrite: true });
            const glow   = el.querySelector('.aurora-glow')   as HTMLElement;
            const border = el.querySelector('.aurora-border') as HTMLElement;
            if (glow)   gsap.to(glow,   { opacity: 1, duration: 0.4, ease: 'power2.out' });
            if (border) gsap.to(border, { opacity: 1, duration: 0.4, ease: 'power2.out' });
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            gsap.to(omegaSpeed, { v: OMEGA, duration: 2.0, ease: 'power2.inOut', overwrite: true });
            gsap.to(hoverScales, { [i]: 1, duration: 0.8, ease: 'power2.inOut', overwrite: true });
            const glow   = el.querySelector('.aurora-glow')   as HTMLElement;
            const border = el.querySelector('.aurora-border') as HTMLElement;
            if (glow)   gsap.to(glow,   { opacity: 0, duration: 0.6, ease: 'power2.inOut' });
            if (border) gsap.to(border, { opacity: 0, duration: 0.6, ease: 'power2.inOut' });
          }}
        >
          {/* Card */}
          <div style={{
            width: WIDGET_SIZE, height: CARD_H,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${accent}15 0%, rgba(255,255,255,0.04) 60%, rgba(0,0,0,0.1) 100%)`,
            border: `1px solid ${accent}25`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: `
              0 8px 32px rgba(0,0,0,0.35),
              inset 0 1px 0 rgba(255,255,255,0.08)
            `,
            overflow: 'hidden', position: 'relative', flexShrink: 0,
          }}>
            {/* Hover glow */}
            <div className="aurora-glow" style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse at 30% 50%, ${accent}30 0%, transparent 70%)`,
              opacity: 0, pointerEvents: 'none',
            }} />
            {/* Border highlight on hover */}
            <div className="aurora-border" style={{
              position: 'absolute', inset: -1, borderRadius: 19,
              border: `1.5px solid ${accent}70`,
              opacity: 0, pointerEvents: 'none',
            }} />
            {/* Top shine */}
            <div style={{
              position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
              pointerEvents: 'none',
            }} />
            <WidgetCard label={label} accent={accent} />
          </div>
          {/* Label below */}
          <span style={{
            marginTop: 6,
            fontSize: 11, fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
            lineHeight: 1.2,
            letterSpacing: '0.01em',
            maxWidth: WIDGET_SIZE,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {label}
          </span>
        </div>
        );
      })}
    </div>
  );
}
