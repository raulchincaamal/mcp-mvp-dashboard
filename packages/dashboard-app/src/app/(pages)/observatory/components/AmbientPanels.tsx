'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import GlassPanel from './GlassPanel';
import type { CursorState } from '../hooks/useCursor';

interface Props {
  cursor: CursorState;
  visible: boolean;
}

const AMBIENT_DATA = [
  { label: 'REVENUE', value: '+12.4%', colorVar: '--accent-color' },
  { label: 'SALES', value: '18.4K', colorVar: '--primary' },
  { label: 'CUSTOMERS', value: '+8.2%', colorVar: '--primary-dark' },
  { label: 'GROWTH', value: '↗ 24%', colorVar: '--warning' },
];

const POSITIONS = [
  { top: '15%', left: '8%', depth: 0.3 },
  { top: '12%', right: '10%', depth: 0.5 },
  { bottom: '25%', left: '10%', depth: 0.4 },
  { bottom: '18%', right: '12%', depth: 0.6 },
];

export default function AmbientPanels({ cursor, visible }: Props) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (!el) return;
      gsap.to(el, {
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.85,
        duration: 0.8,
        delay: visible ? i * 0.15 : 0,
        ease: 'power3.out',
      });
    });
  }, [visible]);

  return (
    <>
      {AMBIENT_DATA.map((item, i) => (
        <div
          key={item.label}
          ref={el => { refs.current[i] = el; }}
          style={{
            position: 'absolute',
            ...POSITIONS[i],
            opacity: 0,
            zIndex: 2,
          }}
        >
          <GlassPanel cursor={cursor} depth={POSITIONS[i].depth}>
            <div style={{ padding: '18px 24px', minWidth: 110 }}>
              <p style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: 'var(--text-tertiary)',
                margin: 0,
                textTransform: 'uppercase',
              }}>
                {item.label}
              </p>
              <p style={{
                fontSize: 26,
                fontWeight: 700,
                color: `var(${item.colorVar})`,
                margin: '6px 0 0',
                letterSpacing: '-0.02em',
              }}>
                {item.value}
              </p>
            </div>
          </GlassPanel>
        </div>
      ))}
    </>
  );
}
