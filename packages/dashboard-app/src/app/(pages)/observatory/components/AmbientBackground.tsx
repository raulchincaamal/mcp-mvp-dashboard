'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { cursorRef } from '../hooks/useCursor';

interface Props {
  onCategoryClick?: (label: string, rect: DOMRect) => void;
}

const CATEGORY_SVGS: Record<string, string> = {
  Motos: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="34" r="7" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="36" cy="34" r="7" stroke="white" stroke-width="2.5" fill="none"/>
    <path d="M12 34 L19 20 L28 20 L36 34" stroke="white" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
    <path d="M28 20 L32 14 L38 14" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <path d="M19 20 L24 14" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  Celulares: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="6" width="20" height="36" rx="4" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="24" cy="38" r="2" fill="white" opacity="0.7"/>
    <line x1="19" y1="12" x2="29" y2="12" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  </svg>`,
  Bicicletas: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="32" r="8" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="36" cy="32" r="8" stroke="white" stroke-width="2.5" fill="none"/>
    <path d="M12 32 L20 16 L28 16 L36 32" stroke="white" stroke-width="2.5" stroke-linejoin="round" fill="none"/>
    <path d="M20 16 L24 32" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <circle cx="24" cy="16" r="2.5" fill="white" opacity="0.8"/>
  </svg>`,
  Pantallas: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="10" width="36" height="24" rx="3" stroke="white" stroke-width="2.5" fill="none"/>
    <line x1="18" y1="34" x2="30" y2="34" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="24" y1="34" x2="24" y2="40" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="16" y1="40" x2="32" y2="40" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  Audio: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="10" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="24" cy="24" r="4" fill="white" opacity="0.8"/>
    <path d="M24 14 C24 14 30 8 38 10" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M24 34 C24 34 30 40 38 38" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
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
  Clima: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 28 C14 22 18 16 24 16 C30 16 34 20 34 26 C37 26 40 29 40 32 C40 35 37 38 34 38 L14 38 C10 38 8 35 8 32 C8 29 11 28 14 28Z" stroke="white" stroke-width="2.5" fill="none"/>
    <path d="M18 42 L18 44 M24 42 L24 44 M30 42 L30 44" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  </svg>`,
};

const N = 8;
const CATEGORIES = ['Motos', 'Celulares', 'Bicicletas', 'Pantallas', 'Audio', 'Tablets', 'Consolas', 'Clima'];

// Aurora accent per category
const AURORA_COLORS: Record<string, string> = {
  Motos:      '#7c6fff',
  Celulares:  '#06b6d4',
  Bicicletas: '#34d399',
  Pantallas:  '#f472b6',
  Audio:      '#fb923c',
  Tablets:    '#a78bfa',
  Consolas:   '#38bdf8',
  Clima:      '#4ade80',
};

// Elipse 3D — eje X horizontal, eje Y inclinado
const RX   = 320;   // radio horizontal (pantalla)
const RY   = 110;   // radio vertical antes de tilt
const TILT = 0.38;  // radianes de inclinación del plano (≈22°)

// Velocidad orbital: una vuelta completa cada ~40s
const OMEGA = (2 * Math.PI) / (40 * 60); // rad/frame a 60fps

// Separación angular uniforme: 2π/8 = 45°
const DELTA_ANGLE = (2 * Math.PI) / N;

const WIDGET_SIZE = 96;
const depthScales  = new Array(N).fill(1);
const hoverScales  = new Array(N).fill(1); // GSAP tweens this, loop reads it

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

      // Advance orbit angle
      angleRef.current += OMEGA;

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

      // Widgets — deterministic, uniform spacing, no overlap
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

        const depth = (wz + RY) / (2 * RY);
        const baseScale = 0.72 + depth * 0.38;
        depthScales[i] = baseScale;

        const el = widgetRefs.current[i];
        if (el) {
          el.style.left    = `${sx - WIDGET_SIZE / 2}px`;
          el.style.top     = `${sy - WIDGET_SIZE / 2}px`;
          el.style.zIndex  = String(Math.round(depth * 8) + 1);
          el.style.opacity = String(0.5 + depth * 0.5);
          // Always apply: depth * hover multiplier — no conflict with GSAP
          el.style.transform = `scale(${baseScale * hoverScales[i]})`;
        }

        // Update line
        const lg = lineGeosRef.current[i];
        if (lg) {
          const lp = lg.attributes.position as THREE.BufferAttribute;
          lp.setXYZ(0, 0, 0, 0);
          lp.setXYZ(1, wx, wy, wz);
          lp.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

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
            width: WIDGET_SIZE, height: WIDGET_SIZE,
            borderRadius: 20,
            // Glassmorphism base
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer', pointerEvents: 'auto',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
            userSelect: 'none',
            willChange: 'transform, opacity',
            overflow: 'hidden',
          }}
          onClick={e => onCategoryClick?.(label, e.currentTarget.getBoundingClientRect())}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.dataset.hovered = '1';
            gsap.to(hoverScales, { [i]: 1.15, duration: 0.7, ease: 'power2.inOut', overwrite: true });
            const glow    = el.querySelector('.aurora-glow')    as HTMLElement;
            const border  = el.querySelector('.aurora-border')  as HTMLElement;
            const icon    = el.querySelector('.widget-icon')    as HTMLElement;
            if (glow)   gsap.to(glow,   { opacity: 1, duration: 0.6, ease: 'power2.inOut' });
            if (border) gsap.to(border, { opacity: 1, duration: 0.6, ease: 'power2.inOut' });
            if (icon)   gsap.to(icon,   { opacity: 1, scale: 1.08, duration: 0.6, ease: 'power2.inOut' });
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            delete el.dataset.hovered;
            gsap.to(hoverScales, { [i]: 1, duration: 0.8, ease: 'power2.inOut', overwrite: true });
            const glow    = el.querySelector('.aurora-glow')    as HTMLElement;
            const border  = el.querySelector('.aurora-border')  as HTMLElement;
            const icon    = el.querySelector('.widget-icon')    as HTMLElement;
            if (glow)   gsap.to(glow,   { opacity: 0, duration: 0.8, ease: 'power2.inOut' });
            if (border) gsap.to(border, { opacity: 0, duration: 0.8, ease: 'power2.inOut' });
            if (icon)   gsap.to(icon,   { opacity: 0.85, scale: 1, duration: 0.6, ease: 'power2.inOut' });
          }}
        >
          {/* Aurora glow layer — bottom radial */}
          <div className="aurora-glow" style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at 50% 120%, ${accent}45 0%, transparent 65%)`,
            opacity: 0, pointerEvents: 'none', borderRadius: 'inherit',
          }} />
          {/* Aurora border glow — separate element, opacity tweened by GSAP */}
          <div className="aurora-border" style={{
            position: 'absolute', inset: -1,
            borderRadius: 21,
            border: `1px solid ${accent}`,
            boxShadow: `0 0 18px ${accent}55, inset 0 0 12px ${accent}18`,
            opacity: 0, pointerEvents: 'none',
          }} />
          {/* Top shimmer line */}
          <div style={{
            position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
            borderRadius: 1,
            pointerEvents: 'none',
          }} />
          {/* SVG icon */}
          <div
            className="widget-icon"
            style={{ width: 40, height: 40, opacity: 0.85, position: 'relative', zIndex: 1 }}
            dangerouslySetInnerHTML={{ __html: CATEGORY_SVGS[label] }}
          />
          {/* Label */}
          <span style={{
            fontSize: 9, fontWeight: 700,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.09em', textTransform: 'uppercase',
            position: 'relative', zIndex: 1,
          }}>
            {label}
          </span>
        </div>
        );
      })}
    </div>
  );
}
