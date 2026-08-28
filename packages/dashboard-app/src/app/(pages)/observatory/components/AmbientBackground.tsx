'use client';

import { useRef, useEffect } from 'react';
import React from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { cursorRef } from '../hooks/useCursor';
// AuroraBackground removed — nebulas now live in Three.js scene

interface Props {
  onCategoryClick?: (label: string, rect: DOMRect) => void;
}

const CATEGORY_SVGS: Record<string, string> = {
  Motos: `<svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.1831 1.07143C13.1831 0.47768 13.6729 0 14.2817 0H17.5775C18.1085 0 18.5616 0.37054 18.6577 0.87947L19.1521 3.53572L21.9901 2.61161C22.7042 2.37947 23.4366 2.89733 23.4366 3.62947V6.37058C23.4366 7.10268 22.7042 7.61608 21.9901 7.38838L19.7335 6.65628L19.8937 7.51338C20.0951 8.58928 19.825 9.69648 19.1521 10.5715L16.6254 13.8572C15.7282 15.0268 14.3137 15.7143 12.8169 15.7143H9.869C9.8782 15.8304 9.8873 15.9509 9.8873 16.0715C9.8873 18.2411 8.0838 20 5.8592 20C3.63451 20 1.83099 18.2411 1.83099 16.0715C1.83099 15.9509 1.83556 15.8304 1.8493 15.7143H1.46479C0.65458 15.7143 0 15.0759 0 14.2857V12.8572C0 9.70088 2.62289 7.14288 5.8592 7.14288H8.7887C9.5989 7.14288 10.2535 7.78128 10.2535 8.57148V11.0715C10.2535 12.4465 11.3933 13.567 12.8077 13.5715H12.8169C13.6225 13.5715 14.3824 13.2009 14.8676 12.5715L17.3944 9.28568C17.7011 8.88838 17.8201 8.38398 17.7331 7.89288L16.662 2.14286H14.2817C13.6729 2.14286 13.1831 1.66518 13.1831 1.07143ZM8.0563 9.28568H5.8592C3.83592 9.28568 2.19718 10.884 2.19718 12.8572V13.5715H8.6423C8.2669 12.942 8.0563 12.2098 8.0563 11.4286V9.28568ZM4.02817 3.57143H9.1549C9.7637 3.57143 10.2535 4.04911 10.2535 4.64288C10.2535 5.23658 9.7637 5.71428 9.1549 5.71428H4.02817C3.41937 5.71428 2.92958 5.23658 2.92958 4.64288C2.92958 4.04911 3.41937 3.57143 4.02817 3.57143ZM4.02817 16.0715C4.02817 17.0581 4.84754 17.8572 5.8592 17.8572C6.8708 17.8572 7.6901 17.0581 7.6901 16.0715C7.6901 15.9509 7.6764 15.8304 7.6535 15.7143H4.06479C4.0419 15.8304 4.02817 15.9509 4.02817 16.0715ZM23.8028 16.0715C23.8028 15.5979 23.6099 15.1436 23.2665 14.8088C22.9232 14.4739 22.4574 14.2857 21.9718 14.2857C21.4862 14.2857 21.0205 14.4739 20.6771 14.8088C20.3338 15.1436 20.1408 15.5979 20.1408 16.0715C20.1408 16.5451 20.3338 16.9993 20.6771 17.3341C21.0205 17.669 21.4862 17.8572 21.9718 17.8572C22.4574 17.8572 22.9232 17.669 23.2665 17.3341C23.6099 16.9993 23.8028 16.5451 23.8028 16.0715ZM17.9437 16.0715C17.9437 15.0295 18.3681 14.0303 19.1235 13.2935C19.8789 12.5568 20.9035 12.1429 21.9718 12.1429C23.0402 12.1429 24.0647 12.5568 24.8202 13.2935C25.5756 14.0303 26 15.0295 26 16.0715C26 17.1134 25.5756 18.1126 24.8202 18.8494C24.0647 19.5861 23.0402 20 21.9718 20C20.9035 20 19.8789 19.5861 19.1235 18.8494C18.3681 18.1126 17.9437 17.1134 17.9437 16.0715Z" fill="white"/></svg>`,
  Celulares: `<svg width="14" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.54545 1.875C2.19545 1.875 1.90909 2.15625 1.90909 2.5V17.5C1.90909 17.8438 2.19545 18.125 2.54545 18.125H11.4545C11.8045 18.125 12.0909 17.8438 12.0909 17.5V2.5C12.0909 2.15625 11.8045 1.875 11.4545 1.875H2.54545ZM0 2.5C0 1.1211 1.14148 0 2.54545 0H11.4545C12.8585 0 14 1.1211 14 2.5V17.5C14 18.8789 12.8585 20 11.4545 20H2.54545C1.14148 20 0 18.8789 0 17.5V2.5ZM7 13.75C7.3375 13.75 7.6613 13.8817 7.9 14.1161C8.1386 14.3506 8.2727 14.6685 8.2727 15C8.2727 15.3315 8.1386 15.6495 7.9 15.8839C7.6613 16.1183 7.3375 16.25 7 16.25C6.6625 16.25 6.3387 16.1183 6.1 15.8839C5.8614 15.6495 5.7273 15.3315 5.7273 15C5.7273 14.6685 5.8614 14.3506 6.1 14.1161C6.3387 13.8817 6.6625 13.75 7 13.75Z" fill="white"/></svg>`,
  'Bicicletas Eléctricas': `<svg width="27" height="20" viewBox="0 0 27 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.0196 0.50447C14.2105 0.19197 14.5525 0 14.9211 0H19.5395C20.1301 0 20.6053 0.47768 20.6053 1.07143C20.6053 1.66518 20.1301 2.14286 19.5395 2.14286H16.6263L19.8326 8.76788C20.3077 8.63838 20.8051 8.57148 21.3158 8.57148C24.4554 8.57148 27 11.1295 27 14.2857C27 17.442 24.4554 20 21.3158 20C18.1762 20 15.6316 17.442 15.6316 14.2857C15.6316 12.4107 16.5286 10.75 17.9141 9.70538L17.0082 7.83478L13.7442 14.3973C13.6421 14.6116 13.4645 14.7902 13.238 14.8973C13.2113 14.9107 13.1847 14.9197 13.1581 14.9286C13.0293 14.9777 12.8961 15 12.7628 14.9956L11.324 15C10.9732 17.817 8.584 20 5.6842 20C2.54457 20 0 17.442 0 14.2857C0 11.1295 2.54457 8.57148 5.6842 8.57148C6.1638 8.57148 6.6257 8.62948 7.0697 8.74108L8.3354 6.20088L7.8247 4.99998H6.0395C5.4488 4.99998 4.9737 4.52228 4.9737 3.92858C4.9737 3.33483 5.4488 2.85715 6.0395 2.85715H8.5263C8.9526 2.85715 9.339 3.11161 9.5077 3.50447L10.1428 4.99998H15.636L13.9618 1.54018C13.802 1.20983 13.8197 0.81697 14.0151 0.50447H14.0196ZM9.4367 8.78128L7.4117 12.8572H11.1775L9.4411 8.78128H9.4367ZM12.865 11.384L14.9743 7.14288H11.0576L12.865 11.384ZM20.3566 14.7545L18.8734 11.692C18.1895 12.3438 17.7632 13.2634 17.7632 14.2857C17.7632 16.259 19.353 17.8572 21.3158 17.8572C23.2786 17.8572 24.8684 16.259 24.8684 14.2857C24.8684 12.3125 23.2786 10.7143 21.3158 10.7143C21.1382 10.7143 20.9605 10.7277 20.7918 10.7545L22.275 13.817C22.5326 14.3482 22.3105 14.9911 21.7821 15.25C21.2536 15.509 20.6141 15.2857 20.3566 14.7545ZM5.9151 15C5.0181 15 4.4319 14.0491 4.836 13.2411L6.0839 10.7366C5.9551 10.7232 5.8219 10.7143 5.6887 10.7143C3.72582 10.7143 2.13602 12.3125 2.13602 14.2857C2.13602 16.259 3.72582 17.8572 5.6887 17.8572C7.4072 17.8572 8.8416 16.6295 9.1702 15H5.9196H5.9151Z" fill="white"/></svg>`,
  'Pantallas/TV': `<svg width="24" height="20" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.66667 2C2.3 2 2 2.3 2 2.66667V13.3333C2 13.7 2.3 14 2.66667 14H21.3333C21.7 14 22 13.7 22 13.3333V2.66667C22 2.3 21.7 2 21.3333 2H2.66667ZM0 2.66667C0 1.19583 1.19583 0 2.66667 0H21.3333C22.8042 0 24 1.19583 24 2.66667V13.3333C24 14.8042 22.8042 16 21.3333 16H2.66667C1.19583 16 0 14.8042 0 13.3333V2.66667ZM6.3333 18H17.6667C18.2208 18 18.6667 18.4458 18.6667 19C18.6667 19.5542 18.2208 20 17.6667 20H6.3333C5.7792 20 5.3333 19.5542 5.3333 19C5.3333 18.4458 5.7792 18 6.3333 18Z" fill="white"/></svg>`,
  Audio: `<svg width="19" height="20" viewBox="0 0 19 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.03571 9.33338C2.03571 5.28338 5.37768 2.00001 9.5 2.00001C13.6223 2.00001 16.9643 5.28338 16.9643 9.33338V11.2C16.3663 10.8584 15.6708 10.6667 14.9286 10.6667H14.25C13.1261 10.6667 12.2143 11.5625 12.2143 12.6667V18C12.2143 19.1042 13.1261 20 14.25 20H14.9286C17.1763 20 19 18.2084 19 16V9.33338C19 4.17917 14.7462 0 9.5 0C4.25379 0 0 4.17917 0 9.33338V16C0 18.2084 1.82366 20 4.07143 20H4.75C5.8739 20 6.7857 19.1042 6.7857 18V12.6667C6.7857 11.5625 5.8739 10.6667 4.75 10.6667H4.07143C3.32924 10.6667 2.63371 10.8625 2.03571 11.2V9.33338ZM2.03571 14.6667C2.03571 13.5625 2.94754 12.6667 4.07143 12.6667H4.75V18H4.07143C2.94754 18 2.03571 17.1042 2.03571 16V14.6667ZM16.9643 14.6667V16C16.9643 17.1042 16.0525 18 14.9286 18H14.25V12.6667H14.9286C16.0525 12.6667 16.9643 13.5625 16.9643 14.6667Z" fill="white"/></svg>`,
  Tablets: `<svg width="26" height="20" viewBox="0 0 26 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.3889 2.14286C9.3889 3.71876 8.0934 4.99998 6.5 4.99998V10.7143C8.0934 10.7143 9.3889 11.9956 9.3889 13.5715H20.9444C20.9444 11.9956 22.2399 10.7143 23.8333 10.7143V4.99998C22.2399 4.99998 20.9444 3.71876 20.9444 2.14286H9.3889ZM4.33333 2.85715C4.33333 1.28126 5.6288 0 7.2222 0H23.1111C24.7045 0 26 1.28126 26 2.85715V12.8572C26 14.4331 24.7045 15.7143 23.1111 15.7143H7.2222C5.6288 15.7143 4.33333 14.4331 4.33333 12.8572V2.85715ZM15.1667 4.28572C16.1244 4.28572 17.0429 4.66198 17.7201 5.33178C18.3973 6.00158 18.7778 6.90998 18.7778 7.85718C18.7778 8.80438 18.3973 9.71278 17.7201 10.3825C17.0429 11.0523 16.1244 11.4286 15.1667 11.4286C14.2089 11.4286 13.2904 11.0523 12.6132 10.3825C11.936 9.71278 11.5556 8.80438 11.5556 7.85718C11.5556 6.90998 11.936 6.00158 12.6132 5.33178C13.2904 4.66198 14.2089 4.28572 15.1667 4.28572ZM1.08333 4.28572C1.68368 4.28572 2.16667 4.76338 2.16667 5.35718V17.1429C2.16667 17.5357 2.49167 17.8572 2.88889 17.8572H20.5833C21.1837 17.8572 21.6667 18.3348 21.6667 18.9286C21.6667 19.5223 21.1837 20 20.5833 20H2.88889C1.29549 20 0 18.7188 0 17.1429V5.35718C0 4.76338 0.48299 4.28572 1.08333 4.28572Z" fill="white"/></svg>`,
  Consolas: `<svg width="64" height="54" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="16" width="36" height="20" rx="8" stroke="white" stroke-width="2.5" fill="none"/><circle cx="32" cy="24" r="2.5" fill="white" opacity="0.8"/><circle cx="38" cy="24" r="2.5" fill="white" opacity="0.8"/><line x1="14" y1="22" x2="14" y2="28" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="25" x2="17" y2="25" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
  'Climatización': `<svg width="64" height="54" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="12" width="36" height="16" rx="4" stroke="white" stroke-width="2.5" fill="none"/><line x1="6" y1="20" x2="42" y2="20" stroke="white" stroke-width="1.5" opacity="0.4"/><path d="M12 28 L10 36 M18 28 L16 36 M24 28 L24 36 M30 28 L32 36 M36 28 L38 36" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7"/><circle cx="35" cy="16" r="2.5" fill="white" opacity="0.8"/></svg>`,
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
const RX   = 540;   // radio horizontal amplio para evitar solapamiento
const RY   = 155;   // radio vertical para efecto 3D más pronunciado
const TILT = 0.5;   // inclinación del plano (~28°) para mejor perspectiva 3D

// Velocidad orbital: una vuelta completa cada ~50s
const OMEGA = (2 * Math.PI) / (50 * 60); // rad/frame a 60fps

// Separación angular uniforme: 2π/8 = 45°
const DELTA_ANGLE = (2 * Math.PI) / N;

const WIDGET_SIZE = 121;
const CARD_H      = 132;
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

const ICON_SIZE: Record<string, number> = { Consolas: 72, 'Climatización': 72 };

function WidgetCard({ label, accent }: { label: string; accent: string }) {
  const { display } = useTicker(label);
  const pct    = MOCK_CHANGE[label] ?? 0;
  const isUp   = pct >= 0;
  const pctCol = isUp ? '#34d399' : '#f87171';
  const num    = display >= 1000 ? `${(display / 1000).toFixed(1)}k` : Math.round(display).toString();

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'grid',
      gridTemplateRows: '1fr auto',
      alignItems: 'center',
      justifyItems: 'center',
      padding: '8px 8px 14px',
      boxSizing: 'border-box',
      zIndex: 2,
    }}>
      {/* Icon */}
      <div
        style={{
          width: ICON_SIZE[label] ?? 56, height: ICON_SIZE[label] ?? 56,
          opacity: 0.8,
          filter: `drop-shadow(0 0 8px ${accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          alignSelf: 'center',
        }}
        dangerouslySetInnerHTML={{ __html: CATEGORY_SVGS[label].replace(/<svg /, '<svg style="width:100%;height:100%" ') }}
      />
      {/* Ticker */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <span style={{
          fontSize: 20, fontWeight: 700, color: 'white',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: '"Chivo Mono", monospace',
          lineHeight: 1,
        }}>
          {num}
        </span>
        <span style={{
          position: 'absolute',
          right: `calc(50% - ${num.length * 7 + 13}px)`,
          display: 'flex', alignItems: 'center',
          color: pctCol,
          lineHeight: 1,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            {isUp ? (
              <>
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </>
            ) : (
              <>
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="5 12 12 19 19 12" />
              </>
            )}
          </svg>
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

    // ── Nebulas (3D sprites, parallax with camera) ─────────────────────────
    function makeNebulaTex(color: string, opacity: number): THREE.Texture {
      const size = 512;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d')!;
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0,    color.replace(')', `, ${opacity})`).replace('rgb', 'rgba'));
      g.addColorStop(0.4,  color.replace(')', `, ${opacity * 0.5})`).replace('rgb', 'rgba'));
      g.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(cv);
    }

    const NEBULA_DEFS = [
      { x: -600, y:  280, z: -400, sx: 1100, sy: 750,  color: 'rgb(30,100,255)',  op: 0.55 },
      { x:  550, y:  100, z: -300, sx:  900, sy: 700,  color: 'rgb(0,180,255)',   op: 0.45 },
      { x: -200, y: -320, z: -500, sx: 1000, sy: 800,  color: 'rgb(10,60,200)',   op: 0.40 },
      { x:  400, y: -250, z: -600, sx:  800, sy: 650,  color: 'rgb(0,120,220)',   op: 0.38 },
      { x:   50, y:   80, z: -350, sx:  700, sy: 550,  color: 'rgb(0,160,240)',   op: 0.30 },
    ];

    const nebulaMats: THREE.SpriteMaterial[] = [];
    NEBULA_DEFS.forEach(def => {
      const tex = makeNebulaTex(def.color, def.op);
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 1,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      nebulaMats.push(mat);
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(def.x, def.y, def.z);
      sprite.scale.set(def.sx, def.sy, 1);
      scene.add(sprite);
    });

    // ── Particles ──────────────────────────────────────────────────────────
    // Layer 1: dense small stars
    const PC1 = 600;
    const pPos1 = new Float32Array(PC1 * 3);
    const pVel1 = new Float32Array(PC1 * 2);
    for (let i = 0; i < PC1; i++) {
      pPos1[i * 3]     = (Math.random() - 0.5) * 1600;
      pPos1[i * 3 + 1] = (Math.random() - 0.5) * 1000;
      pPos1[i * 3 + 2] = (Math.random() - 0.5) * 400;
      pVel1[i * 2]     = (Math.random() - 0.5) * 0.08;
      pVel1[i * 2 + 1] = (Math.random() - 0.5) * 0.08;
    }
    const pGeo1 = new THREE.BufferGeometry();
    pGeo1.setAttribute('position', new THREE.BufferAttribute(pPos1, 3));
    scene.add(new THREE.Points(pGeo1,
      new THREE.PointsMaterial({ color: 0xaabbff, size: 1.8, transparent: true, opacity: 0.65, sizeAttenuation: true })
    ));

    // Layer 2: bright accent stars (fewer, bigger)
    const PC2 = 120;
    const pPos2 = new Float32Array(PC2 * 3);
    const pVel2 = new Float32Array(PC2 * 2);
    for (let i = 0; i < PC2; i++) {
      pPos2[i * 3]     = (Math.random() - 0.5) * 1600;
      pPos2[i * 3 + 1] = (Math.random() - 0.5) * 1000;
      pPos2[i * 3 + 2] = (Math.random() - 0.5) * 400;
      pVel2[i * 2]     = (Math.random() - 0.5) * 0.05;
      pVel2[i * 2 + 1] = (Math.random() - 0.5) * 0.05;
    }
    const pGeo2 = new THREE.BufferGeometry();
    pGeo2.setAttribute('position', new THREE.BufferAttribute(pPos2, 3));
    scene.add(new THREE.Points(pGeo2,
      new THREE.PointsMaterial({ color: 0x66ccff, size: 3.5, transparent: true, opacity: 0.85, sizeAttenuation: true })
    ));

    // Alias pGeo to pGeo1 for the animation loop
    const pGeo = pGeo1;
    const PC   = PC1;
    const pVel = pVel1;

    // ── Particle connections — DISABLED for performance ───────────────────

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
    // Cache line materials for direct access
    const lineMaterials: THREE.LineBasicMaterial[] = [];
    for (let i = 0; i < N; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0x5577ff, transparent: true, opacity: 0.22 });
      scene.add(new THREE.Line(geo, mat));
      lineGeos.push(geo);
      lineMaterials.push(mat);
    }
    lineGeosRef.current = lineGeos;

    // ── Light pulses traveling center → card (mini CoreLight style) ──────────────────────────────
    type PulseGroup = THREE.Group & { _coreMat: THREE.SpriteMaterial };
    interface Pulse { lineIdx: number; t: number; speed: number; group: PulseGroup; }
    const pulses: Pulse[] = [];

    function makeGlowTex(): THREE.Texture {
      const size = 128;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d')!;
      const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      g.addColorStop(0,    'rgba(255,255,255,1)');
      g.addColorStop(0.12, 'rgba(180,210,255,0.9)');
      g.addColorStop(0.35, 'rgba(100,150,255,0.5)');
      g.addColorStop(0.7,  'rgba(60,100,255,0.15)');
      g.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(cv);
    }

    const sharedGlowTex = makeGlowTex();

    function makePulseGroup(): PulseGroup {
      const group = new THREE.Group() as PulseGroup;
      const coreMat = new THREE.SpriteMaterial({ map: sharedGlowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const core = new THREE.Sprite(coreMat);
      core.scale.set(18, 18, 1);
      group.add(core);
      group._coreMat = coreMat;
      scene.add(group);
      return group;
    }

    // Spawn a pulse on a random line every 1.2–2.8s
    let nextSpawnTime = performance.now() + 800;
    const spawnPulse = () => {
      const idx = Math.floor(Math.random() * N);
      pulses.push({ lineIdx: idx, t: 0, speed: 0.006 + Math.random() * 0.006, group: makePulseGroup() });
    };

    // ── Resize ─────────────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // Reusable vector for projection
    const projVec = new THREE.Vector3();

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

      // Particles — typed array access
      const pp = pGeo.attributes.position as THREE.BufferAttribute;
      const arr = pp.array as Float32Array;
      for (let i = 0; i < PC; i++) {
        let x = arr[i * 3]     + pVel[i * 2];
        let y = arr[i * 3 + 1] + pVel[i * 2 + 1];
        if (x >  800) x = -800; if (x < -800) x =  800;
        if (y >  500) y = -500; if (y < -500) y =  500;
        arr[i * 3]     = x;
        arr[i * 3 + 1] = y;
      }
      pp.needsUpdate = true;

      // Layer 2 particles
      const pp2 = pGeo2.attributes.position as THREE.BufferAttribute;
      const arr2 = pp2.array as Float32Array;
      for (let i = 0; i < PC2; i++) {
        let x = arr2[i * 3]     + pVel2[i * 2];
        let y = arr2[i * 3 + 1] + pVel2[i * 2 + 1];
        if (x >  800) x = -800; if (x < -800) x =  800;
        if (y >  500) y = -500; if (y < -500) y =  500;
        arr2[i * 3]     = x;
        arr2[i * 3 + 1] = y;
      }
      pp2.needsUpdate = true;

      // Spawn pulses on timer
      const now = performance.now();
      if (now >= nextSpawnTime) {
        spawnPulse();
        nextSpawnTime = now + 1200 + Math.random() * 1600;
      }

      // Animate pulses
      for (let p = pulses.length - 1; p >= 0; p--) {
        const pulse = pulses[p];
        pulse.t += pulse.speed;
        const a = angleRef.current + pulse.lineIdx * DELTA_ANGLE;
        const wx = RX * Math.cos(a);
        const wy = RY * Math.sin(a) * Math.cos(TILT);
        const wz = RY * Math.sin(a) * Math.sin(TILT);
        const lp = lineProgresses[pulse.lineIdx];
        const tt = Math.min(pulse.t, 1);
        pulse.group.position.set(wx * lp * tt, wy * lp * tt, wz * lp * tt);

        // Fade in/out
        const fade = tt < 0.15 ? tt / 0.15 : tt > 0.8 ? (1 - tt) / 0.2 : 1;
        pulse.group._coreMat.opacity = fade * 0.95;

        if (pulse.t >= 1) {
          scene.remove(pulse.group);
          pulse.group._coreMat.dispose();
          pulses.splice(p, 1);
        }
      }

      // Widgets — GSAP 3D billboard (always flat, facing viewer)
      for (let i = 0; i < N; i++) {
        const a  = angleRef.current + i * DELTA_ANGLE;
        const wx = RX * Math.cos(a);
        const wy = RY * Math.sin(a) * Math.cos(TILT);
        const wz = RY * Math.sin(a) * Math.sin(TILT);

        // Project to screen — reuse vector
        projVec.set(wx, wy, wz).project(camera);
        const sx = ( projVec.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-projVec.y * 0.5 + 0.5) * window.innerHeight;

        // Depth: 0 = back, 1 = front
        const depth = (wz + RY) / (2 * RY);
        
        // Scale based on depth (3D effect)
        const scale = (0.65 + depth * 0.35) * hoverScales[i];

        const el = widgetRefs.current[i];
        if (el) {
          const totalH = CARD_H + LABEL_H;
          const depth = (wz + RY) / (2 * RY);
          const baseScale = (0.65 + depth * 0.35) * hoverScales[i];
          const finalScale = baseScale * splashScales[i];
          // Direct style manipulation instead of gsap.set
          el.style.transform = `translate(${sx - WIDGET_SIZE / 2}px, ${sy - totalH / 2}px) scale(${finalScale})`;
          el.style.zIndex = String(Math.round(depth * 100) + 10);
          if (cardVisible[i]) el.style.visibility = 'visible';
        }

        // Update line — interpolate from center to widget based on lineProgresses[i]
        const lg = lineGeosRef.current[i];
        if (lg) {
          const lp = lg.attributes.position as THREE.BufferAttribute;
          const p = lineProgresses[i];
          lp.setXYZ(0, 0, 0, 0);
          lp.setXYZ(1, wx * p, wy * p, wz * p);
          lp.needsUpdate = true;
          lineMaterials[i].opacity = 0.22 * p;
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
        tl.to(splashScales,   { [i]: 1, duration: 0.7, ease: 'back.out(1.6)' }, i * 0.08);
        tl.to(lineProgresses, { [i]: 1, duration: 0.8, ease: 'power3.out'    }, i * 0.08 + 0.1);
      }
    };
    requestAnimationFrame(waitForPosition);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      pulses.forEach(p => {
        scene.remove(p.group);
        p.group._coreMat?.dispose();
      });
      nebulaMats.forEach(m => { m.map?.dispose(); m.dispose(); });
      sharedGlowTex.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Three.js canvas */}
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
              if (border) border.style.outlineColor = `${accent}cc`;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget;
              gsap.to(omegaSpeed, { v: OMEGA, duration: 2.0, ease: 'power2.inOut', overwrite: true });
              gsap.to(hoverScales, { [i]: 1, duration: 0.8, ease: 'power2.inOut', overwrite: true });
              const glow   = el.querySelector('.aurora-glow')   as HTMLElement;
              const border = el.querySelector('.aurora-border') as HTMLElement;
              if (glow)   gsap.to(glow,   { opacity: 0, duration: 0.6, ease: 'power2.inOut' });
              if (border) border.style.outlineColor = `${accent}50`;
            }}
          >
            {/* Card */}
            <div style={{
              width: WIDGET_SIZE, height: CARD_H,
              borderRadius: 18,
              background: `${accent}18`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)`,
              overflow: 'hidden', position: 'relative', flexShrink: 0,
            }}>
              {/* Solid bg — reads actual --bg value */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundColor: 'var(--bg)',
                opacity: 0.92,
              }} />
              {/* Accent tint */}
              <div style={{
                position: 'absolute', inset: 0,
                background: `linear-gradient(135deg, ${accent}30 0%, transparent 60%)`,
                pointerEvents: 'none',
              }} />
              {/* Hover glow */}
              <div className="aurora-glow" style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(ellipse at 30% 50%, ${accent}40 0%, transparent 70%)`,
                opacity: 0, pointerEvents: 'none',
              }} />
              {/* Border — always visible base + hover highlight */}
              <div className="aurora-border" style={{
                position: 'absolute', inset: 0, borderRadius: 18,
                outline: `1px solid ${accent}50`,
                outlineOffset: '-1px',
                opacity: 1, pointerEvents: 'none',
                transition: 'outline-color 0.4s ease',
              }} />
              {/* Top shine */}
              <div style={{
                position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                pointerEvents: 'none',
              }} />
              <WidgetCard label={label} accent={accent} />
            </div>
            {/* Label */}
            <span style={{
              marginTop: 6, fontSize: 11, fontWeight: 500,
              color: 'rgba(255,255,255,0.6)',
              textAlign: 'center', lineHeight: 1.2, letterSpacing: '0.01em',
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